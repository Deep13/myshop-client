-- Links a packet item (e.g. "KAJU 250GM") to the bulk item it is cut from.
--
-- bulk_item_id  the bulk item that holds the stock, in kg
-- pack_weight   kg in one packet (0.250, 0.500, 1.000)
--
-- An item is a PACKET when pack_weight > 0 AND bulk_item_id IS NOT NULL; it is a
-- BULK item when another row points at it. Only one level is supported — a packet
-- must not itself be a bulk item.
--
-- These are deliberately NOT the existing pack_size / bag_sale_price columns:
-- those mean "kg per bag" for Rice and are divided into cost in get_profit_report.php.
--
-- Run when local MySQL is up:
--   "C:/xampp/mysql/bin/mysql.exe" -u root myshop < db-backup/add_bulk_pack_columns.sql
ALTER TABLE items
  ADD COLUMN bulk_item_id INT           NULL AFTER bag_sale_price,
  ADD COLUMN pack_weight  DECIMAL(10,3) NULL AFTER bulk_item_id,
  ADD KEY idx_items_bulk (bulk_item_id),
  ADD CONSTRAINT fk_items_bulk FOREIGN KEY (bulk_item_id) REFERENCES items (id) ON DELETE SET NULL;
