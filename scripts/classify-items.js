#!/usr/bin/env node
/**
 * Keyword-based item classifier.
 * Reads items.tsv (exported via mysqldump/mysql --batch), applies rules,
 * emits diff CSV + SQL UPDATE file. GST rates are as per current Indian
 * GST rules (so-called "GST 2.0" rate rationalization baseline);
 * verify with your CA before filing.
 *
 * Usage:
 *   1) mysql -u root myshop -B -e "SELECT id, name, code, COALESCE(hsn,'') AS hsn, tax_pct FROM items" > scripts/items.tsv
 *   2) node scripts/classify-items.js
 *   3) Review db-backup/items_classifier_diff.csv
 *   4) mysql -u root myshop < db-backup/items_classifier_update.sql
 */

import fs from "node:fs";
import path from "node:path";

// ── RULES: first match wins, so put narrower patterns first ──
const RULES = [
  // ── Tobacco (28%) ─────────────────────────────────────────────
  { re: /\bcigarette|marlboro|gold\s?flake|four\s?square|navy\s?cut\b|wills/i, hsn: "24022090", tax: 28, cat: "Cigarettes" },
  { re: /\bbeedi|bidi|gutkha|pan\s?masala|khaini|zarda|chewing\s?tobacco\b/i,   hsn: "24039910", tax: 28, cat: "Other tobacco" },

  // ── Beverages ─────────────────────────────────────────────────
  // Soft drinks: explicit brands only. "slice" removed (matches cheese slice); "real" removed (too generic).
  { re: /\b(coca.?cola|pepsi|sprite|fanta|thums.?up|mirinda|7.?up|limca|mountain\s?dew|maaza|frooti|tropicana|appy\s?fizz|rasna|mangola|kurkure\s?drink)\b|soft\s?drink|aerated\s?drink|cold\s?drink/i, hsn: "22021010", tax: 28, cat: "Soft drinks" },
  { re: /\benergy\s?drink|red\s?bull|redbull|sting|monster|rockstar\b/i,        hsn: "22021090", tax: 28, cat: "Energy drinks" },
  { re: /\bfruit\s?juice|orange\s?juice|apple\s?juice\b/i,                      hsn: "20098990", tax: 12, cat: "Fruit juice" },
  { re: /\bwater|aquafina|bisleri|kinley|himalayan|mineral\s?water\b/i,         hsn: "22011010", tax: 18, cat: "Bottled water" },
  // Tea: explicit tea tokens or brands only. Allow plural (bags/leaves). Skip cosmetics.
  { re: /\btea\s?(bag|pack|leaf|leave|dust|powder)s?\b|\bctc\s?tea\b|\btetley\b|\btata\s?tea\b|\bred\s?label\b|\btaj\s?mahal\s?tea|wagh\s?bakri|brooke\s?bond|society\s?tea|\blipton\b|\bliptin\b/i, exclude: /serum|toner|\bgel\b|\bcream\b|sunscreen|lotion|shower|wash|shampoo|face|skin/i, hsn: "09021090", tax: 5, cat: "Tea" },
  { re: /\binstant\s?coffee|nescafe|bru|davidoff|sunrise\s?coffee/i,            hsn: "21011110", tax: 18, cat: "Instant coffee" },
  // Coffee beans/grounds — exclude coffee-flavored chocolate/candy/bar products
  { re: /\bcoffee\b/i,                                                          exclude: /chocolate|\bbar\b|cadbury|hershey|\bhsy\b|kitkat|cake|biscuit|candy|toffee|pastry|muffin|ice\s?cream/i, hsn: "09012110", tax: 5, cat: "Coffee" },
  { re: /\bhorlicks|bournvita|boost|complan|protinex|pediasure\b/i,             hsn: "19019090", tax: 18, cat: "Health drinks" },

  // ── Personal care ─────────────────────────────────────────────
  { re: /\bsanitary|napkin|whisper|stayfree|carefree|sofy|paree\b/i,            hsn: "96190010", tax: 12, cat: "Sanitary napkins" },
  { re: /\bdiaper|pamper|mamy.?poko|huggies|\blibero\b/i,                       hsn: "96190020", tax: 12, cat: "Diapers" },
  { re: /\bshampoo|conditioner|tresemme|head\s?and\s?shoulders|pantene|sunsilk|clinic\s?plus|chik|loreal|schwarzkopf/i, hsn: "33051090", tax: 18, cat: "Shampoo" },
  { re: /\bhair\s?oil|parachute|navratan|almond\s?drop|bajaj\s?almond|dabur\s?amla|kesh\s?king|bajaj\s?brahmi\b/i, hsn: "33059019", tax: 18, cat: "Hair oil" },
  { re: /\bhair\s?dye|hair\s?color|godrej\s?expert|garnier\s?color|loreal\s?color\b/i, hsn: "33059040", tax: 18, cat: "Hair dye" },
  { re: /\btoothpaste|colgate|close.?up|pepsodent|sensodyne|dabur\s?red|meswak|patanjali\s?dant|vicco|himalaya\s?dental\b/i, hsn: "33061020", tax: 18, cat: "Toothpaste" },
  { re: /\btoothbrush|oral.?b|colgate\s?brush|pepsodent\s?brush\b/i,            hsn: "96032100", tax: 18, cat: "Toothbrush" },
  { re: /\bmouthwash|listerine|colgate\s?plax\b/i,                              hsn: "33069000", tax: 18, cat: "Mouthwash" },
  // Deodorant: require deo keyword or brand — exclude face wash / shaving / cream variants
  { re: /\bdeo(?:dorant)?\b|\baxe\b|\bfogg\b|wild\s?stone|park\s?avenue|yardley|set\s?wet|denver|engage/i, exclude: /face\s?wash|body\s?wash|shaving|shave|\bcreme\b|\bcream\b|\bshampoo\b|lotion/i, hsn: "33072000", tax: 18, cat: "Deodorant" },
  { re: /\bperfume|eau\s?de|cologne|attar\b/i,                                  hsn: "33030020", tax: 18, cat: "Perfume" },
  { re: /\bshaving\s?(cream|gel|foam)|gillette|old\s?spice\s?shaving|nivea\s?men\s?shave\b/i, hsn: "33071000", tax: 18, cat: "Shaving prep" },
  { re: /\brazor|razor\s?blade|shave\s?blade|gillette\s?blade\b/i,              hsn: "82121000", tax: 18, cat: "Razor/blade" },
  { re: /\btalc|talcum|pond.?s\s?dream|cuticura|yardley\s?powder\b/i,           hsn: "33073000", tax: 18, cat: "Talcum powder" },
  // Bath soap: exclude face wash / body wash / shampoo variants that share brand names
  { re: /\bsoap\b|\blux\b|cinthol|lifebuoy|dettol\s?soap|pears|santoor|vivel|hamam|mysore\s?sandal|liril|medimix|chandrika|margo|nirma\s?soap|fiama|rexona\s?soap|dove\s?soap|godrej\s?no\b/i, exclude: /face\s?wash|body\s?wash|shampoo|hand\s?wash|shower\s?gel/i, hsn: "34011190", tax: 18, cat: "Bath soap" },
  { re: /\bfacewash|face\s?wash|face\s?cleanser|scrub|face\s?pack|neutrogena|fair\s?lovely|glow\s?lovely|himalaya\s?face|pond.?s\s?face/i, hsn: "33049920", tax: 18, cat: "Face wash" },
  // Face/body cream: require face/body/hand/cold qualifier OR specific brand — excludes peanut butter, cream biscuits, ice cream
  { re: /\b(face|body|hand|cold|night|day|sun|anti.?aging)\s?(cream|lotion|moisturizer)\b|body\s?lotion|vaseline\b|nivea\s?(cream|creme|soft)|ponds\s?(cream|dreamflower)|olay|garnier\s?(cream|skin)|\blakme\b|l'oreal|fair.?and.?handsome/i, exclude: /peanut|ice\s?cream|whip(ped)?\s?cream|cream\s?biscuit|cream\s?cracker/i, hsn: "33049910", tax: 18, cat: "Face/body cream" },
  { re: /\blipstick|lip\s?balm|lip\s?gloss\b/i,                                 hsn: "33041000", tax: 18, cat: "Lip preparations" },
  { re: /\bkajal|eyeliner|mascara|kohl\b/i,                                     hsn: "33042000", tax: 18, cat: "Eye make-up" },
  { re: /\bnail\s?polish|nail\s?paint|nail\s?enamel\b/i,                        hsn: "33043000", tax: 18, cat: "Nail polish" },
  { re: /\bfoundation|compact|blush|make.?up|bb\s?cream|cc\s?cream|concealer\b/i, hsn: "33049990", tax: 18, cat: "Make-up" },
  { re: /\b(comb|hair\s?brush|hair\s?clip|hair\s?pin|hair\s?band)\b/i,          hsn: "96151900", tax: 18, cat: "Combs / hair accessories" },

  // ── Cleaning / household ──────────────────────────────────────
  { re: /\bdetergent\b|\bsurf\b|\btide\b|\bariel\b|\bwheel\b|\brin\b|\bhenko\b|nirma\s?powder|active\s?wheel|\bghadi\b/i, hsn: "34022090", tax: 18, cat: "Detergent" },
  { re: /\bdishwash|vim|exo|pril|dish\s?liquid\b/i,                             hsn: "34022090", tax: 18, cat: "Dishwash" },
  { re: /\bfloor\s?cleaner|lizol|phenyl|harpic|domex|toilet\s?cleaner|urinal\b/i, hsn: "38089400", tax: 18, cat: "Floor / toilet cleaner" },
  { re: /\bair\s?freshener|room\s?freshener|odonil|ambi\s?pur|godrej\s?aer\b/i, hsn: "33074900", tax: 18, cat: "Air freshener" },
  { re: /\bmosquito|repellent|odomos|good\s?knight|mortein|mortien|all\s?out|baygon|hit\b/i, hsn: "38089100", tax: 18, cat: "Insecticide" },
  { re: /\bbleach|vanish|ujala|robin\s?blue|stain\s?remover\b/i,                hsn: "34022090", tax: 18, cat: "Bleach / stain remover" },
  { re: /\bshoe\s?polish|cherry\s?blossom|kiwi\s?polish|metal\s?polish|brasso\b/i, hsn: "34051000", tax: 18, cat: "Polish" },
  { re: /\bagarbatti|incense|dhoop|cycle\s?pure|mangaldeep\b/i,                 hsn: "33074100", tax: 5,  cat: "Agarbatti" },
  { re: /\bcandle\b/i,                                                          hsn: "34060010", tax: 12, cat: "Candles" },
  { re: /\bmatchbox|matches|matchstick\b/i,                                     hsn: "36050090", tax: 12, cat: "Matches" },
  { re: /\blighter|gas\s?lighter\b/i,                                           hsn: "96131000", tax: 18, cat: "Lighter" },
  { re: /\bbroom|jhadu|mop\b/i,                                                 hsn: "96031000", tax: 12, cat: "Broom / mop" },
  { re: /\bgarbage\s?bag|trash\s?bag|dustbin\b/i,                               hsn: "39232990", tax: 18, cat: "Garbage bag" },
  { re: /\bbattery|eveready|nippo|duracell|panasonic\s?battery|\b(aa|aaa|9v)\b/i, hsn: "85061000", tax: 28, cat: "Battery" },

  // ── Groceries / food ──────────────────────────────────────────
  // Baby food / infant cereal — placed before generic rice/atta so "Nestum/Nastum Rice" matches here
  { re: /\bcerelac|nestum|nastum|farex|baby\s?food|infant\s?food|junior\s?horlicks\b/i, hsn: "19011090", tax: 18, cat: "Baby food" },
  { re: /\batta\b|wheat\s?flour|aashirvaad|pillsbury\s?atta|fortune\s?atta|patanjali\s?atta/i, hsn: "11010000", tax: 5, cat: "Atta (packed)" },
  { re: /\bmaida|besan|sooji|rava|poha\b/i,                                     hsn: "11022000", tax: 5,  cat: "Flours" },
  { re: /\bbasmati|sona\s?masoori|kolam|daawat|india\s?gate\b/i,                hsn: "10063020", tax: 5,  cat: "Rice (branded)" },
  // Rice: exclude cosmetic / food products that mention rice as ingredient
  { re: /\brice\b/i,                                                            exclude: /lotion|cream|soap|shampoo|face\s?wash|body|pudding|kheer|biryani|fried\s?rice/i, hsn: "10063090", tax: 0, cat: "Rice" },
  // Pulses: dal word must not follow a brand like DOVE/LUX (shampoo/soap brand names contain DAL)
  { re: /\btoor\b|\barhar\b|\bmoong\b|\bchana\s?dal\b|\bmasoor\b|\burad\b|\bpulses\b/i, hsn: "07139010", tax: 0, cat: "Pulses" },
  { re: /\bsugar|cheeni|shakkar\b/i,                                            hsn: "17019990", tax: 5,  cat: "Sugar" },
  { re: /\bjaggery|gud|gur\b/i,                                                 hsn: "17019100", tax: 0,  cat: "Jaggery" },
  { re: /\bsalt|samudra|tata\s?salt|annapurna\s?salt\b/i,                       hsn: "25010020", tax: 5,  cat: "Salt" },
  { re: /\bsoyabean\s?oil|soya\s?oil\b/i,                                       hsn: "15079010", tax: 5,  cat: "Soyabean oil" },
  { re: /\bmustard\s?oil|sarson\s?ka\s?tel\b/i,                                 hsn: "15141920", tax: 5,  cat: "Mustard oil" },
  // Sunflower oil: require "oil" — SAFFOLA also makes oats/masala products
  { re: /\bsunflower\s?oil\b|\bsundrop\s?oil|fortune\s?sunlite|saffola\s?(oil|tasty|gold|total|active)/i, hsn: "15121190", tax: 5, cat: "Sunflower oil" },
  { re: /\bgroundnut\s?oil|peanut\s?oil\b/i,                                    hsn: "15081000", tax: 5,  cat: "Groundnut oil" },
  { re: /\brefined\s?oil|palm\s?oil|vegetable\s?oil\b|oil\s?1l\b|oil\s?1\s?ltr\b/i, hsn: "15159091", tax: 5, cat: "Edible oil" },
  { re: /\bghee\b|amul\s?ghee|gowardhan\s?ghee|desi\s?ghee/i,                   hsn: "04051000", tax: 12, cat: "Ghee" },
  // Butter: exclude butter-flavored / butter-in-name products (biscuits, candy, curries)
  { re: /\bbutter\b|amul\s?butter/i,                                            exclude: /butter\s?(chicken|masala|paneer|kofta|mix|scotch|biscuit|cookie|bite|cake|candy|toffee)|peanut\s?butter|\bmom\b\s?magic|mom\s?s?\s?magic/i, hsn: "04051000", tax: 12, cat: "Butter" },
  // Cheese: require explicit "cheese slice/block/spread/cube" or paneer — exclude "cheese cracker", "cheese flavour" (biscuits)
  { re: /\bpaneer\b|\bcheese\s?(slice|block|spread|cube|tin)\b/i,               hsn: "04069000", tax: 5,  cat: "Cheese / paneer" },
  // Curd: word-bounded alternation so "classic" / "fantastic" don't false-match via "lassi"
  { re: /\b(curd|dahi|lassi|buttermilk|chaas)\b/i,                              hsn: "04039010", tax: 0,  cat: "Curd" },
  { re: /\bmilk\s?powder|dairy\s?whitener|everyday\s?dairy\b/i,                 hsn: "04022910", tax: 5,  cat: "Milk powder" },
  // Milk: require fresh/toned or brand context + word-bounded "milk" (not "milkybar" / "milkshake")
  { re: /\b(fresh|toned|full\s?cream|double\s?toned|skimmed)\s?milk\b|\bamul\s?milk\b|\bnestle\s?milk\b|\bgokul\s?milk\b|\ba2\s?milk\b|\bmother\s?dairy\s?milk\b/i, exclude: /chocolate|bar|cake|shake|whitener|biscuit|cracker|body|hair/i, hsn: "04012000", tax: 0, cat: "Milk" },
  { re: /\bice.?cream|kwality|amul\s?ice|vadilal|kulfi\b/i,                     hsn: "21050000", tax: 18, cat: "Ice cream" },
  { re: /\bhoney\b/i,                                                           hsn: "04090000", tax: 0,  cat: "Honey" },

  // ── Processed food ────────────────────────────────────────────
  { re: /\bbiscuit|parle|britannia|marie|tiger|bourbon|hide.?seek|good\s?day|dark\s?fantasy|oreo|cream\s?cracker|monaco|krack\s?jack|50.?50|treat|milk\s?bikis|jim\s?jam/i, hsn: "19053100", tax: 18, cat: "Biscuits" },
  // Bread: drop bare "pav" (catches pav-bhaji masala); require bread/bun/rusk
  { re: /\bbread|\bbun\b|\brusk\b|pav\s?(bun|bread|roll)/i,                     hsn: "19059090", tax: 5, cat: "Bread / rusk" },
  { re: /\bcake|pastry|muffin|brownie\b/i,                                      hsn: "19059090", tax: 18, cat: "Cake / pastry" },
  // Condom must come before chocolate (some condom flavors are "chocolate")
  { re: /\bcondom|durex|manforce|kamasutra|skore\b/i,                           hsn: "40141000", tax: 12, cat: "Condom" },
  { re: /\bchocolate|cadbury|dairy\s?milk|kitkat|perk|5\s?star|munch|eclairs\s?chocolate|nestle\s?classic\b/i, hsn: "18063210", tax: 18, cat: "Chocolate" },
  { re: /\bcandy|toffee|alpenliebe|mentos|polo|center\s?(fresh|fruit)|lacto\s?king|melody|pulse|chupa\s?chups|mint\b/i, hsn: "17049090", tax: 18, cat: "Candy / toffee" },
  { re: /\bchewing\s?gum|boomer|center\s?fresh|big\s?babol/i,                   hsn: "17041000", tax: 18, cat: "Chewing gum" },
  { re: /\bchips|lays|kurkure|bingo|uncle\s?chips|balaji|haldiram\s?chips|pringles\b/i, hsn: "19059090", tax: 18, cat: "Chips" },
  { re: /\bnamkeen|bhujia|mixture|sev|khatta|haldiram|bikaji|bikano|lehar/i,    hsn: "21069099", tax: 12, cat: "Namkeen" },
  { re: /\bpapad\b/i,                                                           hsn: "19059040", tax: 0,  cat: "Papad" },
  { re: /\bpickle|achar|mother.?s\s?pickle|priya\s?pickle|nilon/i,              hsn: "20019000", tax: 12, cat: "Pickle" },
  { re: /\bnoodles|maggi|yippee|top\s?ramen|patanjali\s?noodles|smith.?jones|wai.?wai/i, hsn: "19023010", tax: 12, cat: "Noodles" },
  { re: /\bpasta|macaroni|spaghetti|vermicelli|seviyan|bambino/i,               hsn: "19023010", tax: 12, cat: "Pasta" },
  { re: /\bketchup|tomato\s?sauce|kissan|maggi\s?ketchup|tops\b/i,              hsn: "21032000", tax: 12, cat: "Ketchup" },
  { re: /\bsoya\s?sauce|chilli\s?sauce|green\s?chilli\s?sauchae|sauce\b/i,      hsn: "21039090", tax: 12, cat: "Sauce" },
  { re: /\bmayonnaise|veeba|dr.?oetker\b/i,                                     hsn: "21039090", tax: 12, cat: "Mayonnaise" },
  { re: /\bjam|marmalade|fruit\s?spread|kissan\s?jam\b/i,                       hsn: "20079990", tax: 12, cat: "Jam" },
  { re: /\bcornflakes|oats|muesli|kellogg|saffola\s?oats|bagrrys\b/i,           hsn: "11041200", tax: 18, cat: "Breakfast cereals" },
  { re: /\bmaggi\s?masala|mtr|gits\s?ready|ready\s?to\s?eat|instant\s?mix\b/i,  hsn: "21069099", tax: 18, cat: "Ready-to-eat" },
  // Sweets/mithai: specific sweet-names or "indian sweets" — drop bare "sweet" (catches sweet corn, sweet lime)
  { re: /\bmithai\b|\bindian\s?sweets?\b|burfi|barfi|\bladdu\b|rasgulla|gulab\s?jamun|soan\s?papdi|\bpetha\b|\bhalwa\b|\bkaju\s?katli\b|\bjalebi\b/i, hsn: "21069099", tax: 5, cat: "Sweets / mithai" },

  // ── Spices ────────────────────────────────────────────────────
  { re: /\bmasala|garam\s?masala|chaat\s?masala|mdh|everest|badshah|catch\b/i,  hsn: "09109929", tax: 5,  cat: "Masala" },
  { re: /\bturmeric|haldi\b/i,                                                  hsn: "09103020", tax: 5,  cat: "Turmeric" },
  { re: /\bchilli\s?powder|lal\s?mirch|red\s?chilli\b/i,                        hsn: "09042110", tax: 5,  cat: "Chilli powder" },
  { re: /\b(cumin|jeera)\b/i,                                                   hsn: "09093119", tax: 5,  cat: "Cumin" },
  { re: /\b(coriander|dhania)\b/i,                                              hsn: "09092190", tax: 5,  cat: "Coriander" },
  { re: /\bpepper|kali\s?mirch\b/i,                                             hsn: "09041110", tax: 5,  cat: "Pepper" },
  { re: /\bcardamom|elaichi\b/i,                                                hsn: "09083110", tax: 5,  cat: "Cardamom" },
  { re: /\bcloves?|laung\b/i,                                                   hsn: "09071010", tax: 5,  cat: "Cloves" },
  { re: /\bcinnamon|dalchini\b/i,                                               hsn: "09061910", tax: 5,  cat: "Cinnamon" },

  // ── Pharma / OTC ─────────────────────────────────────────────
  { re: /\bvicks|amrutanjan|moov|iodex|zandu\s?balm|tiger\s?balm|volini|relispray|fast\s?relief|krack|ayodex|itch\s?guard\b/i, hsn: "30049099", tax: 12, cat: "Pain / balm" },
  { re: /\bhajmola|pudin\s?hara|eno|gelusil|digene|pan\s?d\b/i,                 hsn: "30049099", tax: 12, cat: "Digestive" },
  { re: /\bcrocin|calpol|paracetamol|dolo|combiflam|disprin|saridon\b/i,        hsn: "30049099", tax: 12, cat: "Pain relief" },
  { re: /\bband.?aid|bandage|gauze|dettol\b/i,                                  hsn: "30051090", tax: 12, cat: "First aid" },
  // Generic medicament tokens — exclude dessert syrup (Hershey's, flavor syrups)
  { re: /\beye\s?drop|oint(ment)?\b|\bsyrup\b|\btablet\b|\bcapsule\b/i,          exclude: /chocolate|strawberry|mango|vanilla|coffee|cocoa|hershey|\bhsy\b|pancake|dessert|cake/i, hsn: "30049099", tax: 12, cat: "Medicament" },

  // ── Stationery ────────────────────────────────────────────────
  { re: /\bpen\b|reynolds|parker|pilot\s?pen|cello\s?pen|uniball|faber\s?castell\s?pen/i, hsn: "96081019", tax: 12, cat: "Pen" },
  { re: /\bpencil|apsara|nataraj|faber\s?castell\s?pencil\b/i,                  hsn: "96091000", tax: 12, cat: "Pencil" },
  { re: /\bnotebook|register|classmate|camlin\s?book|diary\b/i,                 hsn: "48201090", tax: 12, cat: "Notebook" },
  { re: /\benvelope|letter\s?paper\b/i,                                         hsn: "48173000", tax: 18, cat: "Envelope" },
  { re: /\beraser|rubber\b|sharpener|ruler|scale\b/i,                           hsn: "40160000", tax: 18, cat: "Eraser / sharpener" },
  { re: /\bcrayon|marker|highlighter|whiteboard\s?marker\b/i,                   hsn: "96101000", tax: 12, cat: "Crayon / marker" },

  // ── Apparel ───────────────────────────────────────────────────
  { re: /\bt.?shirt|tshirt\b/i,                                                 hsn: "61091000", tax: 5,  cat: "T-shirt" },
  { re: /\bshirt|kurti|kurta|trouser|jean|pant|jeans\b/i,                       hsn: "62034200", tax: 5,  cat: "Apparel" },
  { re: /\bsocks|stockings\b/i,                                                 hsn: "61151000", tax: 5,  cat: "Socks" },
  { re: /\bhanky|handkerchief|towel|napkin\b/i,                                 hsn: "63026000", tax: 5,  cat: "Household linen" },
];

// ─── IO ───────────────────────────────────────────────────────
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ""), "..");
const itemsFile = path.join(repoRoot, "scripts", "items.tsv");
const diffFile = path.join(repoRoot, "db-backup", "items_classifier_diff.csv");
const sqlFile = path.join(repoRoot, "db-backup", "items_classifier_update.sql");

if (!fs.existsSync(itemsFile)) {
  console.error(`Missing ${itemsFile}`);
  console.error(`Run: mysql -u root myshop -B -e "SELECT id, name, code, COALESCE(hsn,'') AS hsn, tax_pct FROM items" > scripts/items.tsv`);
  process.exit(1);
}

const lines = fs.readFileSync(itemsFile, "utf8").split("\n").filter(Boolean);
const header = lines.shift();
console.error(`Loaded ${lines.length} items (header: ${header})`);

const diff = ["id,code,name,old_hsn,new_hsn,old_tax,new_tax,category"];
const sql = ["-- Auto-generated by classify-items.js", "SET autocommit=0;"];
const stats = {};

// Escape single quotes for SQL string literals
const sqlEsc = (s) => String(s ?? "").replace(/'/g, "''");

for (const line of lines) {
  const [id, name, code, oldHsn, oldTax] = line.split("\t");
  const oldTaxNum = parseFloat(oldTax);

  // Find first matching rule (also honor optional `exclude` regex per rule)
  const match = RULES.find((r) => r.re.test(name) && !(r.exclude && r.exclude.test(name)));
  if (!match) {
    // No rule match → still assign "Uncategorized" so every row gets a category
    sql.push(`UPDATE items SET category='Uncategorized' WHERE id=${id};`);
    stats["Uncategorized"] = (stats["Uncategorized"] || 0) + 1;
    continue;
  }

  const newHsn = match.hsn;
  const newTax = match.tax;
  // HSN: only overwrite when empty (don't clobber existing), tax always overwrite
  const hsnToSet = oldHsn && oldHsn !== "" ? oldHsn : newHsn;
  const needsUpdate = hsnToSet !== oldHsn || oldTaxNum !== newTax;

  // Always set category (even if hsn/tax are identical)
  if (needsUpdate) {
    diff.push([
      id, code,
      (name || "").replace(/,/g, ";"),
      oldHsn, hsnToSet,
      oldTax, newTax,
      match.cat,
    ].join(","));
    sql.push(`UPDATE items SET hsn='${sqlEsc(hsnToSet)}', tax_pct=${newTax}, category='${sqlEsc(match.cat)}' WHERE id=${id};`);
  } else {
    sql.push(`UPDATE items SET category='${sqlEsc(match.cat)}' WHERE id=${id};`);
  }
  stats[match.cat] = (stats[match.cat] || 0) + 1;
}
sql.push("COMMIT;");

fs.writeFileSync(diffFile, diff.join("\n"));
fs.writeFileSync(sqlFile, sql.join("\n"));

console.error(`\n── Classification summary ────────────────────`);
const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
for (const [cat, n] of sorted) console.error(`  ${String(n).padStart(4)}  ${cat}`);
console.error(`──────────────────────────────────────────────`);
console.error(`Total rows to update: ${diff.length - 1}`);
console.error(`Diff CSV:  ${diffFile}`);
console.error(`SQL file:  ${sqlFile}`);
