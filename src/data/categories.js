/* Canonical item categories. Each category has a default HSN and GST tax %.
   When a user picks a category on an item, the HSN and tax fields should
   auto-fill to these defaults (user can still override manually).
   Tax % aligned with proposed GST 2.0 rates from
   db-backup/categories_gst_review.csv. Verify with your CA before filing.
   Source of truth — keep this in sync with scripts/classify-items.js. */

export const CATEGORIES = [
  // ── Beverages ─────────────────────────────────────────
  { name: "Soft drinks",            hsn: "22021010", tax: 40 },
  { name: "Energy drinks",          hsn: "22021090", tax: 40 },
  { name: "Fruit juice",            hsn: "20098990", tax: 5  },
  { name: "Bottled water",          hsn: "22011010", tax: 5  },
  { name: "Tea",                    hsn: "09021090", tax: 5  },
  { name: "Coffee",                 hsn: "09012110", tax: 5  },
  { name: "Instant coffee",         hsn: "21011110", tax: 5  },
  { name: "Health drinks",          hsn: "19019090", tax: 5  },

  // ── Tobacco ───────────────────────────────────────────
  { name: "Cigarettes",             hsn: "24022090", tax: 40 },
  { name: "Other tobacco",          hsn: "24039910", tax: 40 },

  // ── Personal care ─────────────────────────────────────
  { name: "Sanitary napkins",       hsn: "96190010", tax: 0  },
  { name: "Diapers",                hsn: "96190020", tax: 5  },
  { name: "Shampoo",                hsn: "33051090", tax: 5  },
  { name: "Hair oil",               hsn: "33059019", tax: 5  },
  { name: "Hair dye",               hsn: "33059040", tax: 5  },
  { name: "Toothpaste",             hsn: "33061020", tax: 5  },
  { name: "Toothbrush",             hsn: "96032100", tax: 5  },
  { name: "Mouthwash",              hsn: "33069000", tax: 5  },
  { name: "Deodorant",              hsn: "33072000", tax: 18 },
  { name: "Perfume",                hsn: "33030020", tax: 18 },
  { name: "Shaving prep",           hsn: "33071000", tax: 5  },
  { name: "Razor/blade",            hsn: "82121000", tax: 18 },
  { name: "Talcum powder",          hsn: "33073000", tax: 5  },
  { name: "Bath soap",              hsn: "34011190", tax: 5  },
  { name: "Face wash",              hsn: "33049920", tax: 5  },
  { name: "Face/body cream",        hsn: "33049910", tax: 18 },
  { name: "Lip preparations",       hsn: "33041000", tax: 18 },
  { name: "Eye make-up",            hsn: "33042000", tax: 18 },
  { name: "Nail polish",            hsn: "33043000", tax: 18 },
  { name: "Make-up",                hsn: "33049990", tax: 18 },
  { name: "Combs / hair accessories", hsn: "96151900", tax: 5  },
  { name: "Cosmetic / skincare",    hsn: "33049990", tax: 18 },

  // ── Cleaning / household ──────────────────────────────
  { name: "Detergent",              hsn: "34022090", tax: 5  },
  { name: "Dishwash",               hsn: "34022090", tax: 5  },
  { name: "Floor / toilet cleaner", hsn: "38089400", tax: 18 },
  { name: "Air freshener",          hsn: "33074900", tax: 18 },
  { name: "Insecticide",            hsn: "38089100", tax: 5  },
  { name: "Bleach / stain remover", hsn: "34022090", tax: 18 },
  { name: "Polish",                 hsn: "34051000", tax: 18 },
  { name: "Agarbatti",              hsn: "33074100", tax: 5  },
  { name: "Candles",                hsn: "34060010", tax: 5  },
  { name: "Matches",                hsn: "36050090", tax: 5  },
  { name: "Lighter",                hsn: "96131000", tax: 18 },
  { name: "Broom / mop",            hsn: "96031000", tax: 5  },
  { name: "Garbage bag",            hsn: "39232990", tax: 18 },
  { name: "Battery",                hsn: "85061000", tax: 18 },
  { name: "LED bulbs / lamps",      hsn: "85395000", tax: 5  },
  { name: "Electric appliances",    hsn: "85437099", tax: 18 },
  { name: "Toys / plastic / cars",  hsn: "95030090", tax: 5  },
  { name: "Electronic toys",        hsn: "95049000", tax: 18 },

  // ── Groceries / food ──────────────────────────────────
  { name: "Atta (packed)",          hsn: "11010000", tax: 5  },
  { name: "Flours",                 hsn: "11022000", tax: 5  },
  { name: "Rice",                   hsn: "10063090", tax: 0  },
  { name: "Rice (branded)",         hsn: "10063020", tax: 5  },
  { name: "Pulses",                 hsn: "07139010", tax: 0  },
  { name: "Sugar",                  hsn: "17019990", tax: 5  },
  { name: "Jaggery",                hsn: "17019100", tax: 0  },
  { name: "Salt",                   hsn: "25010020", tax: 5  },
  { name: "Soyabean oil",           hsn: "15079010", tax: 5  },
  { name: "Mustard oil",            hsn: "15141920", tax: 5  },
  { name: "Sunflower oil",          hsn: "15121190", tax: 5  },
  { name: "Groundnut oil",          hsn: "15081000", tax: 5  },
  { name: "Edible oil",             hsn: "15159091", tax: 5  },
  { name: "Ghee",                   hsn: "04051000", tax: 5  },
  { name: "Butter",                 hsn: "04051000", tax: 5  },
  { name: "Cheese / paneer",        hsn: "04069000", tax: 5  },
  { name: "Curd",                   hsn: "04039010", tax: 0  },
  { name: "Milk powder",            hsn: "04022910", tax: 5  },
  { name: "Milk",                   hsn: "04012000", tax: 0  },
  { name: "Ice cream",              hsn: "21050000", tax: 5  },
  { name: "Honey",                  hsn: "04090000", tax: 0  },
  { name: "Dry fruits / Nuts",      hsn: "08130000", tax: 5  },

  // ── Processed / packaged food ─────────────────────────
  { name: "Biscuits",               hsn: "19053100", tax: 5  },
  { name: "Bread / rusk",           hsn: "19059090", tax: 0  },
  { name: "Cake / pastry",          hsn: "19059090", tax: 5  },
  { name: "Chocolate",              hsn: "18063210", tax: 5  },
  { name: "Candy / toffee",         hsn: "17049090", tax: 5  },
  { name: "Chewing gum",            hsn: "17041000", tax: 18 },
  { name: "Chips",                  hsn: "19059090", tax: 5  },
  { name: "Namkeen",                hsn: "21069099", tax: 5  },
  { name: "Papad",                  hsn: "19059040", tax: 0  },
  { name: "Pickle",                 hsn: "20019000", tax: 5  },
  { name: "Noodles",                hsn: "19023010", tax: 5  },
  { name: "Pasta",                  hsn: "19023010", tax: 5  },
  { name: "Ketchup",                hsn: "21032000", tax: 5  },
  { name: "Sauce",                  hsn: "21039090", tax: 5  },
  { name: "Mayonnaise",             hsn: "21039090", tax: 5  },
  { name: "Jam",                    hsn: "20079990", tax: 5  },
  { name: "Baby food",              hsn: "19011090", tax: 5  },
  { name: "Breakfast cereals",      hsn: "11041200", tax: 5  },
  { name: "Ready-to-eat",           hsn: "21069099", tax: 5  },
  { name: "Sweets / mithai",        hsn: "21069099", tax: 5  },

  // ── Spices ────────────────────────────────────────────
  { name: "Masala",                 hsn: "09109929", tax: 5  },
  { name: "Turmeric",               hsn: "09103020", tax: 5  },
  { name: "Chilli powder",          hsn: "09042110", tax: 5  },
  { name: "Cumin",                  hsn: "09093119", tax: 5  },
  { name: "Coriander",              hsn: "09092190", tax: 5  },
  { name: "Pepper",                 hsn: "09041110", tax: 5  },
  { name: "Cardamom",               hsn: "09083110", tax: 5  },
  { name: "Cloves",                 hsn: "09071010", tax: 5  },
  { name: "Cinnamon",               hsn: "09061910", tax: 5  },

  // ── Pharma / OTC ─────────────────────────────────────
  { name: "Pain / balm",            hsn: "30049099", tax: 5  },
  { name: "Digestive",              hsn: "30049099", tax: 5  },
  { name: "Pain relief",            hsn: "30049099", tax: 5  },
  { name: "First aid",              hsn: "30051090", tax: 5  },
  { name: "Condom",                 hsn: "40141000", tax: 0  },
  { name: "Medicament",             hsn: "30049099", tax: 5  },

  // ── Stationery ────────────────────────────────────────
  { name: "Pen",                    hsn: "96081019", tax: 5  },
  { name: "Pencil",                 hsn: "96091000", tax: 5  },
  { name: "Notebook",               hsn: "48201090", tax: 0  },
  { name: "Envelope",               hsn: "48173000", tax: 18 },
  { name: "Eraser / sharpener",     hsn: "40160000", tax: 5  },
  { name: "Crayon / marker",        hsn: "96101000", tax: 5  },

  // ── Apparel ───────────────────────────────────────────
  { name: "T-shirt",                hsn: "61091000", tax: 5  },
  { name: "Apparel",                hsn: "62034200", tax: 5  },
  { name: "Socks",                  hsn: "61151000", tax: 5  },
  { name: "Household linen",        hsn: "63026000", tax: 5  },

  // ── Fallback ─────────────────────────────────────────
  { name: "Uncategorized",          hsn: "",         tax: 18 },
];

/* Map category name → defaults for quick lookup */
export const CATEGORY_BY_NAME = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c])
);
