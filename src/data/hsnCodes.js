/* Common HSN codes for Indian retail (grocery / supermarket / pharmacy).
   Not exhaustive — covers typical FMCG & OTC items. The `gst` column is
   informational; confirm current GST rates with your CA before filing. */

export const HSN_CODES = [
  // ── Cereals, grains & pulses ──
  { category: "Cereals & Grains", hsn: "1001", description: "Wheat", gst: 0 },
  { category: "Cereals & Grains", hsn: "1006", description: "Rice (unbranded)", gst: 0 },
  { category: "Cereals & Grains", hsn: "1006", description: "Rice (branded/packed)", gst: 5 },
  { category: "Cereals & Grains", hsn: "0713", description: "Pulses / dals (dried)", gst: 0 },
  { category: "Cereals & Grains", hsn: "1101", description: "Wheat flour (atta)", gst: 0 },
  { category: "Cereals & Grains", hsn: "1102", description: "Maize / rice / other cereal flour", gst: 5 },
  { category: "Cereals & Grains", hsn: "1103", description: "Sooji, rava, cereal groats", gst: 5 },
  { category: "Cereals & Grains", hsn: "1104", description: "Rolled / flaked cereals (poha, oats)", gst: 5 },

  // ── Spices ──
  { category: "Spices", hsn: "0904", description: "Pepper, chilli powder", gst: 5 },
  { category: "Spices", hsn: "0906", description: "Cinnamon, dalchini", gst: 5 },
  { category: "Spices", hsn: "0907", description: "Cloves (laung)", gst: 5 },
  { category: "Spices", hsn: "0908", description: "Nutmeg, cardamom, mace", gst: 5 },
  { category: "Spices", hsn: "0909", description: "Cumin (jeera), coriander, fennel seeds", gst: 5 },
  { category: "Spices", hsn: "0910", description: "Ginger, turmeric, masala mixes", gst: 5 },

  // ── Edible oils & ghee ──
  { category: "Oils & Ghee", hsn: "1507", description: "Soyabean oil", gst: 5 },
  { category: "Oils & Ghee", hsn: "1508", description: "Groundnut oil", gst: 5 },
  { category: "Oils & Ghee", hsn: "1512", description: "Sunflower / safflower oil", gst: 5 },
  { category: "Oils & Ghee", hsn: "1515", description: "Other fixed vegetable oils (mustard, sesame)", gst: 5 },
  { category: "Oils & Ghee", hsn: "1517", description: "Vanaspati, edible margarine, ghee mixes", gst: 5 },
  { category: "Oils & Ghee", hsn: "0405", description: "Butter, desi ghee", gst: 12 },

  // ── Dairy ──
  { category: "Dairy", hsn: "0401", description: "Fresh milk (unbranded)", gst: 0 },
  { category: "Dairy", hsn: "0402", description: "Milk powder, condensed / evaporated milk", gst: 5 },
  { category: "Dairy", hsn: "0403", description: "Curd, lassi, buttermilk", gst: 0 },
  { category: "Dairy", hsn: "0406", description: "Cheese, paneer (unpacked)", gst: 0 },
  { category: "Dairy", hsn: "0406", description: "Cheese, paneer (packed/branded)", gst: 5 },
  { category: "Dairy", hsn: "2105", description: "Ice cream & frozen desserts", gst: 18 },
  { category: "Dairy", hsn: "0409", description: "Honey", gst: 0 },

  // ── Sugar & sweeteners ──
  { category: "Sugar & Sweeteners", hsn: "1701", description: "Sugar (cane / beet)", gst: 5 },
  { category: "Sugar & Sweeteners", hsn: "1702", description: "Glucose, jaggery (gud), palm sugar", gst: 0 },
  { category: "Sugar & Sweeteners", hsn: "1703", description: "Molasses", gst: 28 },

  // ── Confectionery & baked goods ──
  { category: "Confectionery", hsn: "1704", description: "Candy, toffee, chewing gum, lozenges", gst: 18 },
  { category: "Confectionery", hsn: "1806", description: "Chocolate & cocoa products", gst: 18 },
  { category: "Biscuits & Bakery", hsn: "1905", description: "Biscuits, cookies, rusk", gst: 18 },
  { category: "Biscuits & Bakery", hsn: "1905", description: "Bread (unsweetened)", gst: 0 },
  { category: "Biscuits & Bakery", hsn: "1905", description: "Cakes, pastries, wafers", gst: 18 },

  // ── Processed & packaged food ──
  { category: "Packaged Food", hsn: "1902", description: "Pasta, noodles, vermicelli, macaroni", gst: 12 },
  { category: "Packaged Food", hsn: "1901", description: "Malt extract, baby / infant cereals", gst: 18 },
  { category: "Packaged Food", hsn: "2007", description: "Jams, jellies, marmalade, fruit purees", gst: 12 },
  { category: "Packaged Food", hsn: "2008", description: "Preserved fruits, nuts (roasted/salted)", gst: 12 },
  { category: "Packaged Food", hsn: "2103", description: "Sauces, ketchup, mayonnaise, pickles", gst: 12 },
  { category: "Packaged Food", hsn: "2104", description: "Soups, broths, instant soups", gst: 18 },
  { category: "Packaged Food", hsn: "2106", description: "Namkeen, bhujia, papad (branded/packed)", gst: 12 },
  { category: "Packaged Food", hsn: "2106", description: "Food preparations, ready-to-eat mixes, health drinks", gst: 18 },

  // ── Beverages ──
  { category: "Beverages", hsn: "0901", description: "Coffee beans, roasted / ground", gst: 5 },
  { category: "Beverages", hsn: "0902", description: "Tea leaves / dust", gst: 5 },
  { category: "Beverages", hsn: "2101", description: "Instant coffee, tea/coffee extracts", gst: 18 },
  { category: "Beverages", hsn: "2009", description: "Fruit juices (without sugar)", gst: 12 },
  { category: "Beverages", hsn: "2201", description: "Water, mineral water (non-sweetened)", gst: 18 },
  { category: "Beverages", hsn: "2202", description: "Soft drinks, aerated beverages, energy drinks", gst: 28 },

  // ── Tobacco ──
  { category: "Tobacco", hsn: "2402", description: "Cigarettes, cigars, cheroots", gst: 28 },
  { category: "Tobacco", hsn: "2403", description: "Beedi, chewing tobacco, gutkha, khaini", gst: 28 },

  // ── Personal care ──
  { category: "Personal Care", hsn: "3303", description: "Perfumes, deodorants, body sprays", gst: 18 },
  { category: "Personal Care", hsn: "3304", description: "Face cream, lotion, lipstick, make-up", gst: 18 },
  { category: "Personal Care", hsn: "3305", description: "Shampoo, hair oil, hair dye, conditioner", gst: 18 },
  { category: "Personal Care", hsn: "3306", description: "Toothpaste, toothbrush, dental floss, mouthwash", gst: 18 },
  { category: "Personal Care", hsn: "3307", description: "Shaving cream, aftershave, talcum powder, wipes", gst: 18 },
  { category: "Personal Care", hsn: "9615", description: "Combs, hair clips, hair pins", gst: 18 },
  { category: "Personal Care", hsn: "9619", description: "Sanitary napkins, diapers, tampons", gst: 12 },

  // ── Household / cleaning ──
  { category: "Household", hsn: "3401", description: "Soap (bathing, laundry bars)", gst: 18 },
  { category: "Household", hsn: "3402", description: "Detergent powder, dish wash, floor cleaner", gst: 18 },
  { category: "Household", hsn: "3405", description: "Shoe polish, metal / furniture polish", gst: 18 },
  { category: "Household", hsn: "3406", description: "Candles, tapers", gst: 12 },
  { category: "Household", hsn: "3808", description: "Mosquito repellents, insecticides, room sprays", gst: 18 },
  { category: "Household", hsn: "3605", description: "Matches (matchsticks)", gst: 12 },
  { category: "Household", hsn: "9613", description: "Lighters, gas lighters", gst: 18 },
  { category: "Household", hsn: "9603", description: "Brooms, brushes, mops", gst: 18 },
  { category: "Household", hsn: "6911", description: "Ceramic / porcelain tableware", gst: 18 },
  { category: "Household", hsn: "3923", description: "Plastic packaging (bags, bottles, containers)", gst: 18 },
  { category: "Household", hsn: "3924", description: "Plastic tableware, kitchenware, toiletware", gst: 18 },
  { category: "Household", hsn: "8506", description: "Dry cell batteries (AA, AAA, 9V)", gst: 28 },

  // ── Pharma / medical ──
  { category: "Pharma", hsn: "3004", description: "Medicines, drugs (retail pack)", gst: 12 },
  { category: "Pharma", hsn: "3004", description: "Life-saving drugs, insulin", gst: 5 },
  { category: "Pharma", hsn: "3005", description: "Bandages, gauze, cotton, first-aid dressings", gst: 12 },
  { category: "Pharma", hsn: "9018", description: "Thermometers, BP monitors, medical instruments", gst: 12 },
  { category: "Pharma", hsn: "3006", description: "Pharmaceutical goods (syringes, suture material)", gst: 12 },

  // ── Stationery ──
  { category: "Stationery", hsn: "4802", description: "Paper (printing, writing)", gst: 12 },
  { category: "Stationery", hsn: "4817", description: "Envelopes, letter cards, postcards", gst: 18 },
  { category: "Stationery", hsn: "4820", description: "Notebooks, diaries, registers, exercise books", gst: 12 },
  { category: "Stationery", hsn: "9608", description: "Ballpoint pens, markers, fountain pens", gst: 12 },
  { category: "Stationery", hsn: "9609", description: "Pencils, crayons, pastels, chalk", gst: 12 },
  { category: "Stationery", hsn: "9017", description: "Geometry instruments (scale, compass, protractor)", gst: 18 },

  // ── Clothing & apparel (ready-made) ──
  { category: "Apparel", hsn: "6109", description: "T-shirts, vests (knitted)", gst: 5 },
  { category: "Apparel", hsn: "6203", description: "Men's suits, trousers, shirts (woven)", gst: 5 },
  { category: "Apparel", hsn: "6204", description: "Women's suits, dresses, skirts", gst: 5 },
  { category: "Apparel", hsn: "6212", description: "Brassieres, girdles, corsets", gst: 5 },
  { category: "Apparel", hsn: "6302", description: "Bed linen, towels, table cloth", gst: 5 },

  // ── Miscellaneous ──
  { category: "Misc", hsn: "4016", description: "Rubber articles (rubber bands, erasers)", gst: 18 },
  { category: "Misc", hsn: "7117", description: "Imitation / fashion jewellery", gst: 3 },
  { category: "Misc", hsn: "9503", description: "Toys, tricycles, dolls", gst: 12 },
  { category: "Misc", hsn: "9504", description: "Playing cards, board games", gst: 12 },
];
