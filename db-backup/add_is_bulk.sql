-- Bulk items v2: an explicit "bulk item" switch, and per-kg prices on bulk items.
--
-- is_bulk = 1  -> the item holds its stock in kg, is never sold at the till, and
--                 its purchase_price / sale_price / mrp are PER KG. Its pack sizes
--                 (items.bulk_item_id = this id) are priced at weight x those rates.
--
-- Must run BEFORE the matching backend deploy: get_inventory.php, get_items_all.php
-- and update_item.php read the column.
--   "C:/xampp/mysql/bin/mysql.exe" -u root myshop < db-backup/add_is_bulk.sql

ALTER TABLE items ADD COLUMN is_bulk TINYINT(1) NOT NULL DEFAULT 0 AFTER pack_weight;

-- Every item that already has pack sizes is a bulk item.
UPDATE items b
JOIN (SELECT DISTINCT bulk_item_id FROM items WHERE bulk_item_id IS NOT NULL) x ON x.bulk_item_id = b.id
SET b.is_bulk = 1;

-- The bulk items were created with no selling price. Give them a per-kg sale price
-- and MRP from their largest pack (BADAM 1KG 151 / 160 -> 151 / 160 per kg). This
-- only fills in the bulk item — the packs keep today's prices until the next
-- purchase of the bulk item, or until its per-kg price is edited.
UPDATE items b
JOIN (
  SELECT p.bulk_item_id AS bid,
         MAX(ROUND(p.sale_price / p.pack_weight, 2)) AS sale_kg,
         MAX(ROUND(p.mrp        / p.pack_weight, 2)) AS mrp_kg
  FROM items p
  JOIN (SELECT bulk_item_id, MAX(pack_weight) AS w
        FROM items WHERE bulk_item_id IS NOT NULL AND pack_weight > 0
        GROUP BY bulk_item_id) mx
    ON mx.bulk_item_id = p.bulk_item_id AND mx.w = p.pack_weight
  GROUP BY p.bulk_item_id
) x ON x.bid = b.id
SET b.sale_price = x.sale_kg, b.mrp = x.mrp_kg
WHERE b.is_bulk = 1 AND b.sale_price = 0 AND b.mrp = 0;

-- Check: every bulk item, its per-kg prices, and how many sizes it has.
SELECT b.id, b.name, b.is_bulk, b.purchase_price AS cost_kg, b.sale_price AS sale_kg, b.mrp AS mrp_kg,
       (SELECT COUNT(*) FROM items p WHERE p.bulk_item_id = b.id) AS sizes
FROM items b WHERE b.is_bulk = 1 ORDER BY b.name;
