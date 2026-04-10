/**
 * GST Rate Correction Script for Ganga Instamart
 * Categorizes items by name patterns and assigns correct Indian GST rates.
 *
 * GST Rates:
 *  5% — Packed food staples (atta, rice, dal, spices, oil, tea, milk, paneer, curd, honey, salt, sugar, papad, agarbatti, rusk, bread, vermicelli, soya chunks, poha, maida, besan)
 * 12% — Butter, cheese, ghee, fruit juice, sauces/ketchup, namkeen/chips/snacks, dry fruits, pickles, jam, diapers, dairy whitener, cornflour, peanut butter, dates, squash
 * 18% — Biscuits, chocolates, shampoo, soap, toothpaste, detergent, cosmetics, deodorant, health drinks, noodles/pasta, ice cream, stationery, household, medicines, baby care products
 * 28% — Aerated/carbonated beverages (Coca Cola, Pepsi, Fanta, Sprite, Thums Up, Mountain Dew, 7Up, Mirinda, Limca, Appy Fizz, energy drinks)
 */

const API = "https://gangashop.in/api";

// ── 28% — Aerated drinks / carbonated beverages ──
const GST_28_PATTERNS = [
  /\bCOCA\s*COLA\b/, /\bPEPSI\b/, /\bFANTA\b/, /\bSPRITE\b/, /\bTHUMS\s*UP\b/,
  /\bMOUNTAIN\s*DEW\b/, /\b7\s*UP\b/, /\bMIRINDA\b/, /\bLIMCA\b/, /\bAPPY\s*FIZZ\b/,
  /\bCAMPA\s*(COLA|LEMON|ORANGE|BERRY|JEERA)\b/, /\bCAMPA\s+\d+/, /\bDIET\s*COKE\b/,
  /\bCOKE\b/, /\bMAZA\b/, /\bMAAAZA\b/, /\bMAAZA\b/, /\bSLICE\b(?!.*CHEESE)/, /\bNIMBOOZ\b/,
  /\bHELL\s*ENERGY\b/, /\bRED\s*BULL\b/, /\bSTING\b/, /\bBUDWEISER\b/, /\bBUDWISER\b/,
  /\bSODA\b(?!.*CAUSTIC)/, /\bTONIC\s*WATER\b/, /\bKINLEY\s*SODA\b/,
];

// ── 5% — Food staples (branded/packed) ──
const GST_5_PATTERNS = [
  // Grains, flour
  /\bATTA\b/, /\bFLOUR\b/, /\bMAIDA\b/, /\bBESAN\b/, /\bCHANA\s*(BESAN|DAL)\b/,
  /\bSUJI\b/, /\bRAVA\b/, /\bSEMOLINA\b/, /\bRICE\b(?!.*CRISP)(?!.*BISCUIT)(?!.*FLAKE)/,
  /\bBASMATI\b/, /\bPOHA\b/, /\bCHIRA\b(?!.*BHAJA)/, /\bCHIWDA\b/,

  // Dal, pulses
  /\bDAL\b(?!.*MAKHANI)(?!.*FRY)/, /\bMOONG\b(?!.*DAL\s*FRY)/, /\bMASOOR\b/, /\bTOOR\b/,
  /\bARHAR\b/, /\bRAJMA\b(?!.*MASALA\s*MIX)/, /\bCHANA\s*DAL\b/,

  // Salt, sugar
  /\bSALT\b(?!.*BISCUIT)(?!.*CRACKER)(?!.*CHIP)(?!.*LAYS)(?!.*PEPPER)(?!.*DEODORANT)/,
  /\bSUGAR\b(?!.*FREE)(?!.*COATED)(?!.*CANDY)/,
  /\bMISRI\b/, /\bTALMISRI\b/, /\bPALM\s*CANDY\b/, /\bJAGGERY\b/, /\bGUR\b(?!.*CHANA)/,

  // Tea (not iced tea/bottled)
  /\bTATA\s*TEA\b/, /\bBROOKE?\s*BOND\b/, /\bWAGH\s*BAKRI\b/, /\bTAJMAHAL\s*TEA\b/,
  /\bRED\s*LABEL\b/, /\bSOCIETY\s*TEA\b/, /\bTEA\b(?!.*TREE)(?!.*BISCUIT)(?!.*CAKE)(?!.*SPOON)/,
  /\bTAAZA\b(?!.*MILK)/, /\bCHAI\b(?!.*BISCUIT)/,

  // Edible oils
  /\bMUSTARD\s*OIL\b/, /\bSOYABEAN\s*OIL\b/, /\bSUNFLOWER\s*OIL\b/, /\bREFINED\s*(OIL|SOYABEAN|SUNFLOWER)\b/,
  /\bKACHI\s*GHANI\b/, /\bTIL\s*OIL\b/, /\bOLIVE\s*OIL\b/, /\bCOCONUT\s*OIL\b(?!.*HAIR)/,
  /\bEDIBLE\s*OIL\b/, /\bVANASPATI\b/, /\bDALDA\b/,
  /\bFORTUNE\s*(MUSTARD|SOYA|SUNFLOWER|KACHI|OIL)\b/,
  /\bSAFFOLA\s*(GOLD|TOTAL|ACTIVE|AURA)\b(?!.*MASALA)(?!.*OATS)/,

  // Milk (fresh/packed)
  /\bAMUL\s*(GOLD|TAZA|TAJA|COW|MASTI\s*1KG)\b/,
  /\bFRESH\s*MILK\b/,

  // Paneer, Curd, Lassi, Buttermilk
  /\bPANEER\b(?!.*TIKKA)(?!.*BUTTER\s*MASALA)(?!.*CHILLI)(?!.*MIX)/,
  /\bDAHI\b/, /\bCURD\b/, /\bLASSI\b/, /\bBUTTERMILK\b/, /\bCHAACH\b/,
  /\bAMUL\s*MASTI\s*BUTTERMILK\b/,

  // Honey
  /\bHONEY\b(?!.*LOOP)(?!.*CHEW)(?!.*OAT)/,

  // Spices & masalas
  /\bEVEREST\b/, /\bMDH\b/, /\bCATCH\b(?!.*CANDY)/, /\bCOOKME\b/,
  /\bTURMERIC\b/, /\bHALDI\b/, /\bCHILLI\s*POWDER\b/, /\bDHANIYA\b(?!.*GOTA)/,
  /\bCORIANDER\s*POWDER\b/, /\bJEERA\b(?!.*SODA)(?!.*BISCUIT)/, /\bCUMIN\b/,
  /\bGARAM\s*MASALA\b/, /\bKITCHEN\s*KING\b/, /\bSABJI\s*MASALA\b/,
  /\bBLACK\s*PEPPER\s*(POWDER|50G|100G)\b/, /\bCHAAT\s*MASALA\b/,
  /\bBIRYANI\s*(MASALA|MIX)\b/, /\bCHICKEN\s*(MASALA|CURRY\s*MIX|BIRYANI)\b/,
  /\bMEAT\s*MASALA\b/, /\bSAMBHAR\s*MASALA\b/, /\bPAV\s*BHAJI\s*MASALA\b/,
  /\bCHHOLE?\s*MASALA\b/, /\bTANDOORI\b/, /\bTIKHALAL\b/, /\bKASHMIRI\s*LAL\b/,
  /\bKASURI\s*METHI\b/, /\bHINGRAJ\b/, /\bSAFFRON\b/, /\bAJWAIN\b/,
  /\bCLOVE\b/, /\bDALCHINI\b/, /\bCINNAMON\b/, /\bBLACK\s*SALT\b/,
  /\bGINGER\s*GARLIC\s*PASTE\b/, /\bDRY\s*MANGO\b/, /\bJALJIRA\b/,
  /\bCHILLI\s*FLAKES\b/, /\bCHILLI\s*VINEGAR\b/,

  // Soya chunks
  /\bSOYA\s*CHUNKS?\b/, /\bSOYA\s*BARI\b/, /\bNUTRELA\b/,

  // Vermicelli/Seviyan
  /\bVERMICELLI\b/, /\bSEVIYAN\b/, /\bBAMBINO\b(?!.*PASTA)/,

  // Papad
  /\bPAPAD\b/, /\bAPPALAM\b/,

  // Agarbatti, incense, dhoop, puja items
  /\bAGARBATTI\b/, /\bINCENSE\b/, /\bDHOOP\b/, /\bCYCLE\b.*\b(LIA|RHYTHM|GODHULI|SAROJA|SANDALUM|MOGRA|WATT|WICKS|SHINING|CAMPHOR|PUJA\s*OIL|SHANTHI|NAIVEDYA|DURGESHWARI|CONES|STICKS)\b/,
  /\bBALAJI\s*CHANDAN\b/, /\bAKASH\s*PHOOL\b/,
  /\bEFFECTS\s*INCENSE\b/, /\bFOREST\s*FRAGRANCE\b/, /\bBLUM\s*MUSK\b/,

  // Rusk, Bread
  /\bRUSK\b/, /\bBREAD\b(?!.*SPREAD)(?!.*STICK)(?!.*CRUMB)/,

  // Cream (dairy fresh cream)
  /\bFRESH\s*CREAM\b/,
  /\bAMUL\s*FRESH\s*CREAM\b/,

  // Makhana
  /\bMAKHANA\b/,

  // Match sticks
  /\bMATCHIS\b/, /\bMATCH\s*BOX\b/,
];

// ── 12% — Processed food, dairy products, snacks ──
const GST_12_PATTERNS = [
  // Butter, Cheese, Ghee
  /\bBUTTER\b(?!.*SCOTCH)(?!.*BISCUIT)(?!.*COOKIE)(?!.*CREAM)(?!.*RUSK)(?!.*MASKA)(?!.*GOLMAAL)(?!.*CHICKEN)(?!.*MASALA)(?!.*PEANUT)(?!.*POPCORN)(?!.*LOVERS)(?!.*BLAST)/,
  /\bCHEESE\b(?!.*BISCUIT)(?!.*WOWZER)(?!.*NACHOS)(?!.*NACHO)(?!.*BALL)(?!.*RAMEN)/,
  /\bGHEE\b/,

  // Fruit juices, drinks
  /\bREAL\s*(FRUIT|JUICE|MIXED|MANGO|GUAVA|ORANGE|APPLE|POMEGRANATE|CRANBERRY|LITCHI|GRAPE|PINEAPPLE|MASALA)/,
  /\bTROPICANA\b/, /\bB\s*NATURAL\b/, /\bPAPER\s*BOAT\b/,
  /\bFRUIT\s*JUICE\b/, /\bJUICE\b(?!.*FACE)(?!.*HAIR)/,
  /\bAMUL\s*KOOL\b/, /\bAMUL\s*COOL\b/, /\bAMUL\s*KADHAI\s*DOODH\b/,
  /\bFLAVOURED?\s*MILK\b/, /\bFLAVOR\b.*MILK/,
  /\bMILK\s*SHAKE\b/, /\bMILKSHAKE\b/,

  // Sauces, Ketchup
  /\bKETCHUP\b/, /\bSOY\s*SAUCE\b/, /\bCHILLI\s*SAUCE\b/, /\bTOMATO\s*SAUCE\b/,
  /\bCHINGS?\b.*\bSAUCE\b/,  /\bMAYONNAISE\b/, /\bMAYO\b/,
  /\bCHINGS?\s*TOMATO\s*KETCHUP\b/, /\bDEL\s*MONTE\b.*KETCHUP/,
  /\bVINEGAR\b/,

  // Namkeen, chips, snacks
  /\bNAMKEEN\b/, /\bBHUJIA\b/, /\bMIXTURE\b/, /\bCHANACHUR\b/, /\bBHELPURI\b/,
  /\bCHIWDA\b/, /\bFARSAN\b/, /\bSEV\b(?!.*IYAN)/,
  /\bLAYS\b/, /\bBINGO\b/, /\bUNCLE\s*CHIPS\b/, /\bKURKURE\b/,
  /\bDORITOS\b/, /\bCHEETOS\b/, /\bFUN\s*FLIPS\b/,
  /\bCHIPPO?\s*(MAGIC|MASALA|STYLE|TREAT|SALT)?\b.*CHIPS?/,
  /\bPOTATO\s*CHIPS\b/, /\bPOTATOZ\b/,
  /\bTEDHE?\s*MEDHE\b/, /\bMAD\s*ANGLE/, /\bNACHO[SZ]?\b/,
  /\bHALDIRAM\b/, /\bPRINGLES\b/, /\bALIVA\b/,
  /\bCHOWKHAS\b/, /\bMURMURA\b/,

  // Jam, preserve
  /\bJAM\b(?!.*BISCUIT)/, /\bMARMALADE\b/, /\bKISSAN\b/,

  // Dry fruits (packed)
  /\bALMOND\b/, /\bBADAM\b(?!.*MILK)(?!.*OIL)(?!.*HAIR)(?!.*SHAMPOO)/,
  /\bCASHEW\b/, /\bKAJU\b/,
  /\bWALNUT\b/, /\bPISTA\b/, /\bRAISIN\b/, /\bKISMIS\b/,
  /\bAMERICAN\s*NUTS\b/, /\bDRY\s*DATES\b/, /\bCHOARA\b/,
  /\bDATES\b(?!.*PENCIL)(?!.*STAMP)/,
  /\bFLAX\s*SEED\b/, /\bCHIA\s*SEED\b/,

  // Diapers
  /\bPAMPERS\b/, /\bHUGGIES\b/, /\bMAMY\s*POKO\b/, /\bMANY\s*POKO\b/, /\bDIAPER\b/, /\bDAIPER\b/,
  /\bHUG\s*DRY\b/, /\bLUVLAP\b.*DIAPER/,

  // Dairy whitener / milk powder
  /\bDAIRY\s*WHITENER\b/, /\bAMULSPRAY\b/, /\bAMUL\s*SPRAY\b/, /\bAMULYA\b/,
  /\bMITHAI\s*MATE\b/, /\bMILK\s*POW?DER\b/,

  // Cornflour
  /\bCORNFLOUR\b/, /\bCORN\s*FLOUR\b/,

  // Peanut butter
  /\bPEANUT\s*BUTTER\b/,

  // Pickles
  /\bPICKLE\b/, /\bACHAR\b/, /\bACHAAR\b/,

  // Squash
  /\bSQUASH\b/,

  // Tomato puree/paste
  /\bTOMATO\s*(PUREE|PASTE)\b/,

  // Coconut milk
  /\bCOCONUT\s*MILK\b/,

  // Spread (cheese/chocolate spread)
  /\bSPREAD\b(?!.*SHEET)/,

  // Chocolate syrup
  /\bCHOCOLATE?\s*SYRUP\b/,
];

// Everything else stays 18% (biscuits, chocolates, shampoo, soap, toothpaste,
// detergent, cosmetics, deodorant, health drinks, noodles, pasta, ice cream, etc.)

async function main() {
  const res = await fetch(`${API}/get_items_all.php?limit=10000`);
  const json = await res.json();
  const items = json.data || [];

  const buckets = { 5: [], 12: [], 18: [], 28: [] };

  for (const item of items) {
    const name = (item.name || "").toUpperCase();
    const currentTax = parseFloat(item.tax || item.tax_pct || 18);
    let newTax = 18; // default

    // Check 28% first (carbonated drinks)
    if (GST_28_PATTERNS.some(p => p.test(name))) {
      newTax = 28;
    }
    // Check 5% (food staples)
    else if (GST_5_PATTERNS.some(p => p.test(name))) {
      newTax = 5;
    }
    // Check 12% (processed food, dairy, snacks)
    else if (GST_12_PATTERNS.some(p => p.test(name))) {
      newTax = 12;
    }

    if (newTax !== currentTax) {
      buckets[newTax].push({ id: item.id, name: item.name, from: currentTax });
    }
  }

  console.log("\n=== GST CORRECTION PLAN ===\n");
  for (const rate of [5, 12, 18, 28]) {
    const list = buckets[rate];
    if (!list.length) continue;
    console.log(`\n── Moving to ${rate}% (${list.length} items) ──`);
    list.forEach(it => console.log(`  [${it.id}] ${it.name} (was ${it.from}%)`));
  }

  // Apply updates
  for (const rate of [5, 12, 28]) {
    const ids = buckets[rate].map(it => it.id);
    if (!ids.length) continue;

    console.log(`\nUpdating ${ids.length} items to ${rate}%...`);
    const r = await fetch(`${API}/bulk_update_tax.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxPct: rate, itemIds: ids }),
    });
    const j = await r.json();
    console.log(`  Result: ${j.message} — ${j.itemsUpdated} items, ${j.inventoryUpdated} inventory rows`);
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(`  5%  : ${buckets[5].length} items changed`);
  console.log(`  12% : ${buckets[12].length} items changed`);
  console.log(`  18% : ${buckets[18].length} items (no change needed)`);
  console.log(`  28% : ${buckets[28].length} items changed`);
  console.log(`  Total changed: ${buckets[5].length + buckets[12].length + buckets[28].length}`);
}

main().catch(console.error);
