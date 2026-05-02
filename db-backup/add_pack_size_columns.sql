-- Adds pack_size and bag_sale_price columns to items table.
-- Run when local MySQL is up:
--   "C:/xampp/mysql/bin/mysql.exe" -u root myshop < db-backup/add_pack_size_columns.sql
ALTER TABLE items
  ADD COLUMN pack_size      DECIMAL(10,3) NULL AFTER sale_price,
  ADD COLUMN bag_sale_price DECIMAL(10,2) NULL AFTER pack_size;
