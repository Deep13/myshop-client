-- ============================================================================
-- 1. Cashew costs 880/kg (owner's figure, replacing the 995.40 derived from the
--    09 Sep bill). Stored as the all-in cost per kg, so every packet's cost
--    follows from it.
-- 2. Merge the duplicate KAJU items into the barcodes that are kept:
--       KAJU 250GM  ITMMO5WW2HP (4244) -> 7558742700779 (4461)
--       KAJU 500GM  ITMMO5WVTB2 (4243) -> 7560371430095 (4460)
--
-- GST filings are NOT affected. The tax rate and gst_flag live on each invoice
-- line, not on the item, so the four lines filed at 18% under ITMMO5WW2HP stay
-- at 18%. Only item-level reporting is unified.
--
-- Both duplicates hold zero stock (verified), so nothing is lost in the move.
-- Run after link_bulk_packs.sql.
-- ============================================================================

CREATE TABLE items_backup_merge_20260920           AS SELECT * FROM items;
CREATE TABLE invoice_items_backup_merge_20260920   AS SELECT * FROM invoice_items;
CREATE TABLE purchase_bill_items_backup_merge_20260920 AS SELECT * FROM purchase_bill_items;

START TRANSACTION;

-- ── 1. Cashew at 880/kg ────────────────────────────────────────────────────
UPDATE items SET purchase_price = 880.00 WHERE code = 'BULK-KAJU';

UPDATE items p
JOIN items b ON b.id = p.bulk_item_id AND b.code = 'BULK-KAJU'
SET p.purchase_price = ROUND(880.00 * p.pack_weight, 2)
WHERE p.pack_weight > 0;
--   100g -> 88.00    250g -> 220.00    500g -> 440.00

-- The opening stock batch carries its own rate, and that is what the till prices
-- a packet from — the item master is only the fallback. It was seeded from the
-- old derived figure, so correct it too or the two disagree.
UPDATE inventory inv
JOIN items b ON b.id = inv.item_id AND b.code = 'BULK-KAJU'
SET inv.purchase_price = 880.00;

-- ── 2. Merge the duplicates ────────────────────────────────────────────────
-- Sales history. item_name is identical on both sides already ("KAJU 250GM"),
-- so only the id and code move.
UPDATE invoice_items SET item_id = 4461, item_code = '7558742700779'
WHERE item_id = 4244 OR (item_id IS NULL AND item_code = 'ITMMO5WW2HP');
UPDATE invoice_items SET item_id = 4460, item_code = '7560371430095'
WHERE item_id = 4243 OR (item_id IS NULL AND item_code = 'ITMMO5WVTB2');

-- Purchase history.
UPDATE purchase_bill_items SET item_id = 4461, item_code = '7558742700779'
WHERE item_id = 4244 OR item_code = 'ITMMO5WW2HP';
UPDATE purchase_bill_items SET item_id = 4460, item_code = '7560371430095'
WHERE item_id = 4243 OR item_code = 'ITMMO5WVTB2';

-- The duplicates' own batches are all at zero; drop them, then the items.
DELETE FROM inventory WHERE item_id IN (4243, 4244);
DELETE FROM items     WHERE id      IN (4243, 4244);

COMMIT;

-- ── Verification — first two must be empty, the rest are for eyeballing ────
SELECT id, name, code FROM items WHERE id IN (4243, 4244);
SELECT id, item_code FROM invoice_items WHERE item_code IN ('ITMMO5WW2HP','ITMMO5WVTB2')
UNION ALL
SELECT id, item_code FROM purchase_bill_items WHERE item_code IN ('ITMMO5WW2HP','ITMMO5WVTB2');

-- Cashew line-up and the margin each packet now earns:
SELECT p.name, p.code, p.pack_weight, p.purchase_price AS cost, p.sale_price,
       ROUND((p.sale_price - p.purchase_price) / NULLIF(p.sale_price,0) * 100, 2) AS margin_pct
FROM items p JOIN items b ON b.id = p.bulk_item_id
WHERE b.code = 'BULK-KAJU' ORDER BY p.pack_weight;

-- Sales history now sitting under the surviving barcodes:
SELECT ii.item_code, ii.tax, ii.gst_flag, COUNT(*) AS lines_, SUM(ii.qty) AS qty
FROM invoice_items ii WHERE ii.item_code IN ('7558742700779','7560371430095')
GROUP BY ii.item_code, ii.tax, ii.gst_flag ORDER BY ii.item_code;

-- ── Rollback ───────────────────────────────────────────────────────────────
-- Restoring the two deleted items needs the backup tables above:
--   INSERT INTO items SELECT * FROM items_backup_merge_20260920 WHERE id IN (4243,4244);
--   UPDATE invoice_items ii JOIN invoice_items_backup_merge_20260920 t ON t.id = ii.id
--     SET ii.item_id = t.item_id, ii.item_code = t.item_code;
--   UPDATE purchase_bill_items p JOIN purchase_bill_items_backup_merge_20260920 t ON t.id = p.id
--     SET p.item_id = t.item_id, p.item_code = t.item_code;
--   UPDATE items i JOIN items_backup_merge_20260920 t ON t.id = i.id SET i.purchase_price = t.purchase_price;
