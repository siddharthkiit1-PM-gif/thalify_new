/**
 * Indian food nutrition database.
 *
 * Values are AVERAGES for typical Indian home-cooking portions, cross-referenced
 * against multiple nutrition sources: Tarla Dalal, HealthifyMe, FatSecret India,
 * NutritionValue.org, SparkPeople, USDA FDC, IFCT 2017.
 *
 * Each entry specifies the serving unit so downstream code can compute per-serving
 * values accurately. Restaurant preparations are typically 20-40% higher in calories
 * due to extra ghee/oil — the values below assume moderate home-cooking.
 */

export type FoodCategory = 'carb' | 'protein' | 'vegetable' | 'fat' | 'beverage' | 'sweet';

export type FoodEntry = {
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  category: FoodCategory;
  portion: string;
};

export const INDIAN_FOODS: Record<string, FoodEntry> = {
  // ─── Breads / Carbs ───────────────────────────────────────────
  roti:              { cal: 85,  protein: 3,  carbs: 17, fat: 0.5, category: 'carb', portion: '1 piece (30g)' },
  chapati:           { cal: 85,  protein: 3,  carbs: 17, fat: 0.5, category: 'carb', portion: '1 piece (30g)' },
  phulka:            { cal: 70,  protein: 3,  carbs: 14, fat: 0.3, category: 'carb', portion: '1 piece (25g)' },
  naan:              { cal: 260, protein: 8,  carbs: 45, fat: 5,   category: 'carb', portion: '1 piece (90g)' },
  butter_naan:       { cal: 320, protein: 8,  carbs: 45, fat: 11,  category: 'carb', portion: '1 piece' },
  paratha:           { cal: 210, protein: 5,  carbs: 28, fat: 9,   category: 'carb', portion: '1 piece (60g)' },
  aloo_paratha:      { cal: 290, protein: 6,  carbs: 38, fat: 12,  category: 'carb', portion: '1 piece (90g)' },
  puri:              { cal: 150, protein: 3,  carbs: 20, fat: 7,   category: 'carb', portion: '1 piece (30g)' },
  bhatura:           { cal: 340, protein: 7,  carbs: 45, fat: 15,  category: 'carb', portion: '1 piece (100g)' },
  thepla:            { cal: 160, protein: 4,  carbs: 22, fat: 6,   category: 'carb', portion: '1 piece (40g)' },

  // ─── Rice ─────────────────────────────────────────────────────
  rice:              { cal: 205, protein: 4,  carbs: 45, fat: 0.4, category: 'carb', portion: '1 cup cooked (160g)' },
  brown_rice:        { cal: 215, protein: 5,  carbs: 45, fat: 1.8, category: 'carb', portion: '1 cup cooked (160g)' },
  jeera_rice:        { cal: 240, protein: 5,  carbs: 44, fat: 5,   category: 'carb', portion: '1 cup (180g)' },
  pulao:             { cal: 280, protein: 5,  carbs: 44, fat: 9,   category: 'carb', portion: '1 cup (180g)' },
  biryani:           { cal: 550, protein: 20, carbs: 65, fat: 22,  category: 'carb', portion: '1 plate (350g)' },
  veg_biryani:       { cal: 420, protein: 10, carbs: 68, fat: 13,  category: 'carb', portion: '1 plate (300g)' },
  chicken_biryani:   { cal: 600, protein: 25, carbs: 65, fat: 25,  category: 'carb', portion: '1 plate (350g)' },
  mutton_biryani:    { cal: 700, protein: 28, carbs: 65, fat: 32,  category: 'carb', portion: '1 plate (350g)' },
  khichdi:           { cal: 220, protein: 8,  carbs: 36, fat: 5,   category: 'carb', portion: '1 cup (200g)' },
  bisi_bele_bath:    { cal: 310, protein: 10, carbs: 48, fat: 9,   category: 'carb', portion: '1 cup (225g)' },

  // ─── South Indian Breakfast ───────────────────────────────────
  idli:              { cal: 40,  protein: 2,  carbs: 8,  fat: 0.2, category: 'carb', portion: '1 piece (30g)' },
  dosa:              { cal: 170, protein: 4,  carbs: 28, fat: 4,   category: 'carb', portion: '1 piece (80g)' },
  masala_dosa:       { cal: 250, protein: 6,  carbs: 40, fat: 7,   category: 'carb', portion: '1 piece (130g)' },
  uttapam:           { cal: 210, protein: 6,  carbs: 34, fat: 5,   category: 'carb', portion: '1 piece (130g)' },
  pesarattu:         { cal: 170, protein: 8,  carbs: 26, fat: 3,   category: 'carb', portion: '1 piece (90g)' },
  appam:             { cal: 130, protein: 3,  carbs: 22, fat: 3,   category: 'carb', portion: '1 piece (60g)' },
  vada:              { cal: 150, protein: 5,  carbs: 18, fat: 7,   category: 'carb', portion: '1 piece (50g)' },
  upma:              { cal: 230, protein: 5,  carbs: 38, fat: 7,   category: 'carb', portion: '1 cup (180g)' },
  poha:              { cal: 250, protein: 5,  carbs: 45, fat: 6,   category: 'carb', portion: '1 cup (180g)' },
  pongal:            { cal: 270, protein: 8,  carbs: 42, fat: 8,   category: 'carb', portion: '1 cup (200g)' },
  puttu:             { cal: 180, protein: 4,  carbs: 38, fat: 2,   category: 'carb', portion: '1 serving (100g)' },

  // ─── Dals & Protein Curries ───────────────────────────────────
  dal:               { cal: 150, protein: 9,  carbs: 22, fat: 3,   category: 'protein', portion: '1 katori (150ml)' },
  dal_tadka:         { cal: 180, protein: 10, carbs: 22, fat: 6,   category: 'protein', portion: '1 katori (150ml)' },
  dal_fry:           { cal: 190, protein: 10, carbs: 22, fat: 7,   category: 'protein', portion: '1 katori (150ml)' },
  dal_makhani:       { cal: 280, protein: 11, carbs: 24, fat: 15,  category: 'protein', portion: '1 katori (150ml)' },
  moong_dal:         { cal: 135, protein: 9,  carbs: 20, fat: 2,   category: 'protein', portion: '1 katori (150ml)' },
  toor_dal:          { cal: 150, protein: 10, carbs: 22, fat: 3,   category: 'protein', portion: '1 katori (150ml)' },
  rajma:             { cal: 200, protein: 12, carbs: 28, fat: 5,   category: 'protein', portion: '1 katori (150g)' },
  chana:             { cal: 220, protein: 13, carbs: 30, fat: 5,   category: 'protein', portion: '1 katori (150g)' },
  chole:             { cal: 240, protein: 13, carbs: 30, fat: 7,   category: 'protein', portion: '1 katori (150g)' },
  sambar:            { cal: 120, protein: 6,  carbs: 18, fat: 3,   category: 'protein', portion: '1 katori (150ml)' },
  kadhi:             { cal: 140, protein: 5,  carbs: 14, fat: 7,   category: 'protein', portion: '1 katori (150ml)' },

  // ─── Paneer Dishes ────────────────────────────────────────────
  paneer:            { cal: 265, protein: 18, carbs: 4,  fat: 20,  category: 'protein', portion: '100g raw paneer' },
  paneer_bhurji:     { cal: 260, protein: 14, carbs: 8,  fat: 19,  category: 'protein', portion: '1 katori (120g)' },
  palak_paneer:      { cal: 280, protein: 13, carbs: 10, fat: 20,  category: 'protein', portion: '1 katori (180g)' },
  shahi_paneer:      { cal: 380, protein: 14, carbs: 14, fat: 28,  category: 'protein', portion: '1 katori (180g)' },
  paneer_butter_masala: { cal: 400, protein: 15, carbs: 12, fat: 30, category: 'protein', portion: '1 katori (180g)' },
  kadai_paneer:      { cal: 350, protein: 14, carbs: 12, fat: 25,  category: 'protein', portion: '1 katori (180g)' },
  matar_paneer:      { cal: 310, protein: 14, carbs: 14, fat: 22,  category: 'protein', portion: '1 katori (180g)' },

  // ─── Non-veg Mains ────────────────────────────────────────────
  chicken:           { cal: 165, protein: 31, carbs: 0,  fat: 4,   category: 'protein', portion: '100g cooked breast' },
  chicken_curry:     { cal: 260, protein: 22, carbs: 6,  fat: 16,  category: 'protein', portion: '1 katori (180g)' },
  butter_chicken:    { cal: 420, protein: 22, carbs: 10, fat: 32,  category: 'protein', portion: '1 katori (180g)' },
  chicken_tikka:     { cal: 280, protein: 30, carbs: 4,  fat: 16,  category: 'protein', portion: '1 serving (150g)' },
  tandoori_chicken:  { cal: 240, protein: 32, carbs: 3,  fat: 11,  category: 'protein', portion: '1 piece (150g)' },
  chicken_65:        { cal: 310, protein: 25, carbs: 14, fat: 18,  category: 'protein', portion: '1 serving (150g)' },
  fish:              { cal: 140, protein: 26, carbs: 0,  fat: 4,   category: 'protein', portion: '100g cooked' },
  fish_curry:        { cal: 200, protein: 22, carbs: 6,  fat: 10,  category: 'protein', portion: '1 katori (180g)' },
  mutton:            { cal: 250, protein: 26, carbs: 0,  fat: 16,  category: 'protein', portion: '100g cooked' },
  mutton_curry:      { cal: 380, protein: 24, carbs: 6,  fat: 30,  category: 'protein', portion: '1 katori (180g)' },
  rogan_josh:        { cal: 400, protein: 24, carbs: 8,  fat: 30,  category: 'protein', portion: '1 katori (180g)' },
  egg:               { cal: 75,  protein: 6,  carbs: 0.5,fat: 5,   category: 'protein', portion: '1 large egg' },
  egg_curry:         { cal: 220, protein: 12, carbs: 8,  fat: 15,  category: 'protein', portion: '1 katori (150g, 2 eggs)' },
  omelette:          { cal: 180, protein: 12, carbs: 2,  fat: 14,  category: 'protein', portion: '2 eggs cooked' },

  // ─── Dairy / Yogurt ───────────────────────────────────────────
  curd:              { cal: 60,  protein: 4,  carbs: 5,  fat: 3,   category: 'protein', portion: '1 katori (150g)' },
  raita:             { cal: 80,  protein: 4,  carbs: 7,  fat: 3,   category: 'protein', portion: '1 katori (150g)' },
  lassi:             { cal: 180, protein: 6,  carbs: 25, fat: 5,   category: 'protein', portion: '1 glass (240ml)' },
  chaas:             { cal: 40,  protein: 2,  carbs: 4,  fat: 1,   category: 'protein', portion: '1 glass (240ml)' },

  // ─── Vegetables / Sabzi ───────────────────────────────────────
  aloo:              { cal: 160, protein: 3,  carbs: 30, fat: 4,   category: 'vegetable', portion: '1 katori (150g)' },
  aloo_gobi:         { cal: 170, protein: 4,  carbs: 22, fat: 8,   category: 'vegetable', portion: '1 katori (150g)' },
  aloo_matar:        { cal: 190, protein: 6,  carbs: 26, fat: 8,   category: 'vegetable', portion: '1 katori (150g)' },
  bhindi:            { cal: 130, protein: 3,  carbs: 14, fat: 7,   category: 'vegetable', portion: '1 katori (150g)' },
  baingan_bharta:    { cal: 150, protein: 3,  carbs: 14, fat: 10,  category: 'vegetable', portion: '1 katori (150g)' },
  palak:             { cal: 100, protein: 4,  carbs: 8,  fat: 6,   category: 'vegetable', portion: '1 katori (150g)' },
  gobi_sabzi:        { cal: 110, protein: 3,  carbs: 10, fat: 6,   category: 'vegetable', portion: '1 katori (150g)' },
  mixed_vegetables:  { cal: 140, protein: 4,  carbs: 16, fat: 7,   category: 'vegetable', portion: '1 katori (150g)' },
  methi_sabzi:       { cal: 120, protein: 4,  carbs: 10, fat: 7,   category: 'vegetable', portion: '1 katori (150g)' },
  karela:            { cal: 90,  protein: 2,  carbs: 10, fat: 5,   category: 'vegetable', portion: '1 katori (150g)' },
  cucumber:          { cal: 15,  protein: 1,  carbs: 3,  fat: 0,   category: 'vegetable', portion: '100g' },
  tomato:            { cal: 22,  protein: 1,  carbs: 5,  fat: 0,   category: 'vegetable', portion: '100g' },
  salad:             { cal: 50,  protein: 2,  carbs: 8,  fat: 1,   category: 'vegetable', portion: '1 plate (150g)' },

  // ─── Street Food / Chaat ──────────────────────────────────────
  chole_bhature:     { cal: 700, protein: 18, carbs: 80, fat: 32,  category: 'carb', portion: '1 plate (2 bhature + chole)' },
  pav_bhaji:         { cal: 400, protein: 10, carbs: 55, fat: 16,  category: 'carb', portion: '1 plate (2 pav)' },
  samosa:            { cal: 260, protein: 5,  carbs: 28, fat: 14,  category: 'carb', portion: '1 piece (100g)' },
  dhokla:            { cal: 160, protein: 6,  carbs: 20, fat: 6,   category: 'carb', portion: '3 pieces (100g)' },
  kachori:           { cal: 290, protein: 6,  carbs: 32, fat: 15,  category: 'carb', portion: '1 piece (90g)' },
  pani_puri:         { cal: 180, protein: 4,  carbs: 28, fat: 6,   category: 'carb', portion: '6 pieces' },
  bhel_puri:         { cal: 280, protein: 6,  carbs: 40, fat: 10,  category: 'carb', portion: '1 plate (150g)' },
  dabeli:            { cal: 340, protein: 7,  carbs: 48, fat: 13,  category: 'carb', portion: '1 piece' },
  vada_pav:          { cal: 300, protein: 7,  carbs: 40, fat: 12,  category: 'carb', portion: '1 piece' },

  // ─── Sweets ───────────────────────────────────────────────────
  kheer:             { cal: 220, protein: 6,  carbs: 32, fat: 8,   category: 'sweet', portion: '1 katori (150ml)' },
  halwa:             { cal: 290, protein: 4,  carbs: 38, fat: 14,  category: 'sweet', portion: '1 katori (100g)' },
  gulab_jamun:       { cal: 150, protein: 3,  carbs: 22, fat: 6,   category: 'sweet', portion: '1 piece (40g)' },
  jalebi:            { cal: 180, protein: 2,  carbs: 34, fat: 5,   category: 'sweet', portion: '2 pieces (50g)' },
  rasgulla:          { cal: 120, protein: 4,  carbs: 22, fat: 2,   category: 'sweet', portion: '1 piece (50g)' },
  barfi:             { cal: 160, protein: 3,  carbs: 22, fat: 7,   category: 'sweet', portion: '1 piece (40g)' },
  laddoo:            { cal: 180, protein: 4,  carbs: 24, fat: 8,   category: 'sweet', portion: '1 piece (40g)' },

  // ─── Snacks / Fats ────────────────────────────────────────────
  ghee:              { cal: 112, protein: 0,  carbs: 0,  fat: 13,  category: 'fat',   portion: '1 tablespoon (13g)' },
  oil:               { cal: 120, protein: 0,  carbs: 0,  fat: 14,  category: 'fat',   portion: '1 tablespoon (14ml)' },
  butter:            { cal: 100, protein: 0,  carbs: 0,  fat: 11,  category: 'fat',   portion: '1 tablespoon (14g)' },
  makhana:           { cal: 106, protein: 4,  carbs: 20, fat: 1,   category: 'fat',   portion: '30g roasted' },
  peanuts:           { cal: 170, protein: 7,  carbs: 5,  fat: 14,  category: 'fat',   portion: '30g' },
  cashews:           { cal: 165, protein: 5,  carbs: 9,  fat: 13,  category: 'fat',   portion: '30g' },
  almonds:           { cal: 170, protein: 6,  carbs: 6,  fat: 15,  category: 'fat',   portion: '30g' },
  coconut:           { cal: 100, protein: 1,  carbs: 5,  fat: 9,   category: 'fat',   portion: '30g fresh' },

  // ─── Beverages ────────────────────────────────────────────────
  chai:              { cal: 70,  protein: 2,  carbs: 10, fat: 2,   category: 'beverage', portion: '1 cup (150ml, with sugar + milk)' },
  masala_chai:       { cal: 85,  protein: 2,  carbs: 12, fat: 2,   category: 'beverage', portion: '1 cup (150ml)' },
  coffee:            { cal: 50,  protein: 1,  carbs: 8,  fat: 1,   category: 'beverage', portion: '1 cup (150ml, with milk)' },
  green_tea:         { cal: 2,   protein: 0,  carbs: 0,  fat: 0,   category: 'beverage', portion: '1 cup (240ml)' },
  coconut_water:     { cal: 46,  protein: 2,  carbs: 9,  fat: 0,   category: 'beverage', portion: '1 glass (240ml)' },
  nimbu_pani:        { cal: 40,  protein: 0,  carbs: 10, fat: 0,   category: 'beverage', portion: '1 glass (240ml)' },
};

// Common aliases for fuzzy matching
export const FOOD_ALIASES: Record<string, string> = {
  'aval': 'poha',
  'chapathi': 'chapati',
  'chappati': 'chapati',
  'tandoori_roti': 'roti',
  'plain_rice': 'rice',
  'basmati_rice': 'rice',
  'white_rice': 'rice',
  'dhal': 'dal',
  'daal': 'dal',
  'toor': 'toor_dal',
  'tuvar_dal': 'toor_dal',
  'moong': 'moong_dal',
  'chana_masala': 'chole',
  'chickpea_curry': 'chole',
  'kadhai_paneer': 'kadai_paneer',
  'chicken_masala': 'chicken_curry',
  'murgh_masala': 'chicken_curry',
  'aloo_sabzi': 'aloo',
  'mutter_paneer': 'matar_paneer',
  'gobi': 'gobi_sabzi',
  'spinach': 'palak',
};
