-- Quantity-offer pricing: "buy N for ₹X" on an item.
--
--   offer_qty   = how many pieces the offer covers (2 for a BOGO pair). 0 = no offer.
--   offer_price = what the customer pays for that many, tax-inclusive, in rupees.
--
-- At the till the line is priced as:
--   full sets × offer_price  +  leftover pieces × sale_price
-- so 3 tees on a "2 for 699" offer with a 399 sale price = 699 + 399 = 1098.
--
-- Run once, before deploying the backend that reads these columns.

ALTER TABLE items
  ADD COLUMN offer_qty   INT(11)       NOT NULL DEFAULT 0,
  ADD COLUMN offer_price DECIMAL(10,2) NOT NULL DEFAULT 0.00;
