-- ============================================================================
-- One-time migration: move repacked goods onto bulk items held in kg.
--
-- RUN ORDER (important):
--   1. add_bulk_pack_columns.sql          (schema)
--   2. deploy the new backend + website
--   3. THIS FILE
-- Running this before the code is deployed would leave the packets showing zero
-- stock at the till, because nothing yet knows they are cut from a bulk item.
--
-- Take a backup first. Every section can be run and checked on its own.
-- Item ids below are from the live database on 2026-09-20; re-check them if the
-- master has changed since.
-- ============================================================================

-- ── S0. Safety net ─────────────────────────────────────────────────────────
CREATE TABLE items_backup_20260920     AS SELECT * FROM items;
CREATE TABLE inventory_backup_20260920 AS SELECT * FROM inventory;

START TRANSACTION;

-- ── S1. Create the bulk items (stock in kg, never sold at the till) ─────────
-- sale_price stays 0: these are not scanned at the counter.
--
-- purchase_price is the cost per kg taken from each commodity's MOST RECENT
-- purchase, divided by that packet's weight, then put on a GST-inclusive footing
-- the same way item_master_sync.php does it (a NON-GST bill is grossed up by the
-- item's own rate, so the cost is comparable with a tax-inclusive selling price).
--
--   KAJU     09 Sep 2026  237.00 / 0.25kg  and 474.00 / 0.5kg -> 948.00/kg raw
--                         x 1.05 (5%)                         -> 995.40
--   KISMISH  10 Aug 2026  190.00 / 0.5kg, bill already GST-inclusive -> 380.00
--   CHIA     30 Apr 2026   30.00 / 0.1kg -> 300.00/kg raw, x 1.05    -> 315.00
--                         (that bill is old — check it against the next one)
--   BADAM    26 Aug 2026  145.00 / 1kg  and  72.50 / 0.5kg -> 145.00/kg,
--                         0% GST so no gross-up                      -> 145.00
INSERT INTO items (name, code, hsn, category, mrp, sale_price, purchase_price, tax_pct, is_primary)
VALUES ('KAJU (BULK)',       'BULK-KAJU',    '0801', 'Dry fruits / Nuts', 0, 0, 995.40, 5, 1);
SET @kaju := LAST_INSERT_ID();
INSERT INTO items (name, code, hsn, category, mrp, sale_price, purchase_price, tax_pct, is_primary)
VALUES ('KISMISH (BULK)',    'BULK-KISMISH', '0806', 'Dry fruits / Nuts', 0, 0, 380.00, 5, 1);
SET @kismish := LAST_INSERT_ID();
INSERT INTO items (name, code, hsn, category, mrp, sale_price, purchase_price, tax_pct, is_primary)
VALUES ('CHIA SEEDS (BULK)', 'BULK-CHIA',    '1207', 'Dry fruits / Nuts', 0, 0, 315.00, 5, 1);
SET @chia := LAST_INSERT_ID();
-- BADAM is 0% GST, confirmed by the owner. Its packets stay 0% too.
INSERT INTO items (name, code, hsn, category, mrp, sale_price, purchase_price, tax_pct, is_primary)
VALUES ('BADAM (BULK)',      'BULK-BADAM',   '0802', 'Dry fruits / Nuts', 0, 0, 145.00, 0, 1);
SET @badam := LAST_INSERT_ID();

-- ── S2. Link each packet to its bulk item ──────────────────────────────────
-- Both barcodes of a duplicated packet are linked, so they draw on one pool of
-- stock and can never disagree again. Neither barcode is retired.
UPDATE items SET bulk_item_id = @kaju,    pack_weight = 0.100 WHERE id = 5489; -- KAJU 100GM    6719556429923
UPDATE items SET bulk_item_id = @kaju,    pack_weight = 0.250 WHERE id = 4461; -- KAJU 250GM    7558742700779
UPDATE items SET bulk_item_id = @kaju,    pack_weight = 0.250 WHERE id = 4244; -- KAJU 250GM    ITMMO5WW2HP  (duplicate)
UPDATE items SET bulk_item_id = @kaju,    pack_weight = 0.500 WHERE id = 4460; -- KAJU 500GM    7560371430095
UPDATE items SET bulk_item_id = @kaju,    pack_weight = 0.500 WHERE id = 4243; -- KAJU 500GM    ITMMO5WVTB2  (duplicate)
UPDATE items SET bulk_item_id = @kismish, pack_weight = 0.250 WHERE id = 5604; -- KISMISH 250G  8260533284144
UPDATE items SET bulk_item_id = @kismish, pack_weight = 0.500 WHERE id = 5332; -- KISMISH 500G  5136421873260
UPDATE items SET bulk_item_id = @chia,    pack_weight = 0.100 WHERE id = 4126; -- CHIA SEEDS 100GM 38615969055
UPDATE items SET bulk_item_id = @chia,    pack_weight = 0.100 WHERE id =  546; -- CHIA SEED 100GM  8906167312616 (duplicate)
UPDATE items SET bulk_item_id = @badam,   pack_weight = 0.200 WHERE id = 4115; -- BADAM 200GM   38631913926
UPDATE items SET bulk_item_id = @badam,   pack_weight = 0.250 WHERE id = 5474; -- BADAM 250G    6603105173507
UPDATE items SET bulk_item_id = @badam,   pack_weight = 0.500 WHERE id = 5473; -- BADAM 500G    6602967877363
UPDATE items SET bulk_item_id = @badam,   pack_weight = 1.000 WHERE id = 4526; -- BADAM 1KG     7797850581980

-- ── S3. Move the stock that is on the packets today onto the bulk items ─────
-- Opening stock in kg = sum of (packets in stock x pack weight).
-- purchase_bill_id is left NULL on purpose: that is what lets the quantity be
-- corrected by hand after the first physical count (the app refuses to edit a
-- batch that came from a purchase bill).
INSERT INTO inventory (item_id, purchase_bill_id, batch_no, exp_date, mrp, purchase_price,
                       sale_price, tax_pct, gst_flag, initial_qty, current_qty, created_by)
SELECT b.id, NULL, 'OPENING', NULL, 0, b.purchase_price, 0, b.tax_pct, 1,
       ROUND(SUM(inv.current_qty * p.pack_weight), 3),
       ROUND(SUM(inv.current_qty * p.pack_weight), 3), 1
FROM inventory inv
JOIN items p ON p.id = inv.item_id AND p.pack_weight > 0
JOIN items b ON b.id = p.bulk_item_id
WHERE inv.current_qty > 0
GROUP BY b.id, b.purchase_price, b.tax_pct
HAVING SUM(inv.current_qty * p.pack_weight) > 0;

-- Packets must hold no stock of their own from here on. Zero, never delete:
-- the rows carry the batch/expiry/purchase-bill history.
UPDATE inventory inv
JOIN items p ON p.id = inv.item_id
SET inv.current_qty = 0
WHERE p.pack_weight > 0 AND p.bulk_item_id IS NOT NULL AND inv.current_qty > 0;

-- ── S4. Cleanup the owner asked for ────────────────────────────────────────
-- (a) GST: the duplicate rows were filed at 18% while their twins were at 5%.
--     Dry fruits and nuts are 5%. Past invoices are deliberately left alone —
--     they were filed as they were. tax_pct only sticks when is_primary = 1.
UPDATE items SET tax_pct = 5, is_primary = 1, category = 'Dry fruits / Nuts'
WHERE id IN (4244, 4243, 546);

-- (b) Zero buy prices on the BADAM packets — now derived from the bulk rate.
UPDATE items p JOIN items b ON b.id = p.bulk_item_id
SET p.purchase_price = ROUND(b.purchase_price * p.pack_weight, 2)
WHERE p.pack_weight > 0;

-- (c) OPTIONAL — the duplicated packets sell at different prices (500g cashew
--     at 500 vs 450). Uncomment to make the duplicate match its twin.
-- UPDATE items SET sale_price = 500, mrp = 530 WHERE id = 4243;
-- UPDATE items SET sale_price = 260, mrp = 270 WHERE id = 4244;
-- UPDATE items SET sale_price =  95, mrp = 125 WHERE id =  546;

-- (d) BADAM stays at 0% GST (owner's decision). BADAM 200GM was the odd one out
--     at 18% while its own 250g, 500g and 1kg siblings were 0% — bring it in line.
UPDATE items SET tax_pct = 0 WHERE id = 4115;

COMMIT;

-- ── S5. Verification — every one of these must come back empty or zero ──────
-- A packet with a bulk item but no weight, or the reverse:
SELECT id, name, code FROM items
WHERE (bulk_item_id IS NULL) <> (pack_weight IS NULL OR pack_weight <= 0);

-- A packet still holding its own stock:
SELECT p.id, p.name, SUM(inv.current_qty) AS stock FROM items p
JOIN inventory inv ON inv.item_id = p.id
WHERE p.pack_weight > 0 GROUP BY p.id, p.name HAVING SUM(inv.current_qty) > 0;

-- A chain (a packet used as another item's bulk item):
SELECT c.id, c.name FROM items c JOIN items b ON b.id = c.bulk_item_id
WHERE b.bulk_item_id IS NOT NULL;

-- A bulk item that is sellable or has no stock:
SELECT b.id, b.name, b.sale_price, COALESCE(SUM(inv.current_qty),0) AS kg
FROM items b LEFT JOIN inventory inv ON inv.item_id = b.id
WHERE b.id IN (@kaju, @kismish, @chia, @badam)
GROUP BY b.id, b.name, b.sale_price;

-- What the till will now show for each packet:
SELECT p.name, p.code, p.pack_weight, b.name AS bulk_item,
       COALESCE(SUM(inv.current_qty),0) AS bulk_kg,
       FLOOR(COALESCE(SUM(inv.current_qty),0) / p.pack_weight) AS packs_available
FROM items p
JOIN items b ON b.id = p.bulk_item_id
LEFT JOIN inventory inv ON inv.item_id = b.id AND inv.current_qty > 0
WHERE p.pack_weight > 0
GROUP BY p.id, p.name, p.code, p.pack_weight, b.name
ORDER BY b.name, p.pack_weight;

-- ── Rollback, if needed ────────────────────────────────────────────────────
-- UPDATE items i JOIN items_backup_20260920 t ON t.id = i.id
--   SET i.tax_pct = t.tax_pct, i.is_primary = t.is_primary, i.purchase_price = t.purchase_price,
--       i.category = t.category, i.bulk_item_id = NULL, i.pack_weight = NULL;
-- UPDATE inventory v JOIN inventory_backup_20260920 t ON t.id = v.id SET v.current_qty = t.current_qty;
-- DELETE FROM items WHERE code IN ('BULK-KAJU','BULK-KISMISH','BULK-CHIA','BULK-BADAM');
