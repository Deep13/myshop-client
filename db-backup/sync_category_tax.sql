-- Sync items.tax_pct (and inventory.tax_pct) to the corrected GST 2.0 rates
-- per category, sourced from src/data/categories.js / categories_gst_review.csv.
-- Generated 2026-04-29.

START TRANSACTION;

-- ── 40% (sin / luxury slab) ──────────────────────────────────────
UPDATE items SET tax_pct = 40 WHERE category IN (
  'Soft drinks','Energy drinks','Cigarettes','Other tobacco'
);
UPDATE inventory inv JOIN items it ON it.id = inv.item_id
  SET inv.tax_pct = 40 WHERE it.category IN (
  'Soft drinks','Energy drinks','Cigarettes','Other tobacco'
);

-- ── 18% (cosmetics, sticky-rate household + misc) ────────────────
UPDATE items SET tax_pct = 18 WHERE category IN (
  'Deodorant','Perfume','Razor/blade','Face/body cream',
  'Lip preparations','Eye make-up','Nail polish','Make-up',
  'Cosmetic / skincare','Floor / toilet cleaner','Air freshener',
  'Bleach / stain remover','Polish','Lighter','Garbage bag',
  'Battery','Electric appliances','Chewing gum','Envelope',
  'Uncategorized'
);
UPDATE inventory inv JOIN items it ON it.id = inv.item_id
  SET inv.tax_pct = 18 WHERE it.category IN (
  'Deodorant','Perfume','Razor/blade','Face/body cream',
  'Lip preparations','Eye make-up','Nail polish','Make-up',
  'Cosmetic / skincare','Floor / toilet cleaner','Air freshener',
  'Bleach / stain remover','Polish','Lighter','Garbage bag',
  'Battery','Electric appliances','Chewing gum','Envelope',
  'Uncategorized'
);

-- ── 5% (most FMCG, packaged food, personal care, OTC) ────────────
UPDATE items SET tax_pct = 5 WHERE category IN (
  'Tea','Coffee','Instant coffee','Health drinks','Fruit juice',
  'Bottled water','Diapers','Shampoo','Hair oil','Hair dye',
  'Toothpaste','Toothbrush','Mouthwash','Shaving prep',
  'Talcum powder','Bath soap','Face wash','Combs / hair accessories',
  'Detergent','Dishwash','Insecticide','Agarbatti','Candles',
  'Matches','Broom / mop','LED bulbs / lamps',
  'Atta (packed)','Flours','Rice (branded)','Sugar','Salt',
  'Soyabean oil','Mustard oil','Sunflower oil','Groundnut oil',
  'Edible oil','Ghee','Butter','Cheese / paneer','Milk powder',
  'Ice cream','Dry fruits / Nuts',
  'Biscuits','Cake / pastry','Chocolate','Candy / toffee','Chips',
  'Namkeen','Pickle','Noodles','Pasta','Ketchup','Sauce',
  'Mayonnaise','Jam','Baby food','Breakfast cereals','Ready-to-eat',
  'Sweets / mithai',
  'Masala','Turmeric','Chilli powder','Cumin','Coriander',
  'Pepper','Cardamom','Cloves','Cinnamon',
  'Pain / balm','Digestive','Pain relief','First aid','Medicament',
  'Pen','Pencil','Eraser / sharpener','Crayon / marker',
  'T-shirt','Apparel','Socks','Household linen'
);
UPDATE inventory inv JOIN items it ON it.id = inv.item_id
  SET inv.tax_pct = 5 WHERE it.category IN (
  'Tea','Coffee','Instant coffee','Health drinks','Fruit juice',
  'Bottled water','Diapers','Shampoo','Hair oil','Hair dye',
  'Toothpaste','Toothbrush','Mouthwash','Shaving prep',
  'Talcum powder','Bath soap','Face wash','Combs / hair accessories',
  'Detergent','Dishwash','Insecticide','Agarbatti','Candles',
  'Matches','Broom / mop','LED bulbs / lamps',
  'Atta (packed)','Flours','Rice (branded)','Sugar','Salt',
  'Soyabean oil','Mustard oil','Sunflower oil','Groundnut oil',
  'Edible oil','Ghee','Butter','Cheese / paneer','Milk powder',
  'Ice cream','Dry fruits / Nuts',
  'Biscuits','Cake / pastry','Chocolate','Candy / toffee','Chips',
  'Namkeen','Pickle','Noodles','Pasta','Ketchup','Sauce',
  'Mayonnaise','Jam','Baby food','Breakfast cereals','Ready-to-eat',
  'Sweets / mithai',
  'Masala','Turmeric','Chilli powder','Cumin','Coriander',
  'Pepper','Cardamom','Cloves','Cinnamon',
  'Pain / balm','Digestive','Pain relief','First aid','Medicament',
  'Pen','Pencil','Eraser / sharpener','Crayon / marker',
  'T-shirt','Apparel','Socks','Household linen'
);

-- ── 0% (zero-rated essentials) ───────────────────────────────────
UPDATE items SET tax_pct = 0 WHERE category IN (
  'Sanitary napkins','Rice','Pulses','Jaggery','Curd','Milk',
  'Honey','Bread / rusk','Papad','Condom','Notebook'
);
UPDATE inventory inv JOIN items it ON it.id = inv.item_id
  SET inv.tax_pct = 0 WHERE it.category IN (
  'Sanitary napkins','Rice','Pulses','Jaggery','Curd','Milk',
  'Honey','Bread / rusk','Papad','Condom','Notebook'
);

COMMIT;
