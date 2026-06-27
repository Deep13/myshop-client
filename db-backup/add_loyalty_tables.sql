-- Loyalty program schema.
-- One card per customer (phone is the key). After 5 stamps it's 'completed'.
-- A new card can be issued once the current one is 'redeemed'.

CREATE TABLE IF NOT EXISTS loyalty_cards (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  customer_name        VARCHAR(120) NULL,
  phone                VARCHAR(20)  NOT NULL,
  card_number          INT          NOT NULL DEFAULT 1,           -- nth card for this phone (1, 2, 3, ...)
  status               VARCHAR(20)  NOT NULL DEFAULT 'active',    -- active | completed | redeemed
  issued_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at         DATETIME     NULL,                         -- set when stamp 5 added
  redeemed_at          DATETIME     NULL,                         -- set when ₹100 used on a sale
  redeemed_invoice_id  INT          NULL,                         -- which invoice consumed the ₹100
  redeemed_invoice_no  VARCHAR(40)  NULL,                         -- denormalised label for display
  created_by           INT          NULL,
  updated_by           INT          NULL,
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone  (phone),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS loyalty_stamps (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  card_id         INT          NOT NULL,
  stamp_no        TINYINT      NOT NULL,                          -- 1..5
  invoice_id      INT          NULL,                              -- which sale earned it (optional)
  invoice_no      VARCHAR(40)  NULL,                              -- denormalised for display
  invoice_amount  DECIMAL(10,2) NULL,
  stamped_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stamped_by      INT          NULL,                              -- users.id
  UNIQUE KEY uniq_card_stamp (card_id, stamp_no),
  INDEX idx_card (card_id)
);
