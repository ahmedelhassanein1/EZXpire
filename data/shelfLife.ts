/**
 * Static shelf-life fallback table.
 *
 * Used by `lib/expiry.ts` when Gemini is unavailable or returns an item the
 * caller doesn't recognize. Values are conservative fridge-storage estimates
 * in days; treat them as heuristics, not food-safety guarantees.
 */

export type Category =
  | "dairy"
  | "eggs"
  | "produce_leafy"
  | "produce_hardy"
  | "meat_raw"
  | "meat_cooked"
  | "seafood"
  | "bakery"
  | "canned"
  | "frozen"
  | "condiments"
  | "beverages"
  | "default";

export const SHELF_LIFE_DAYS: Record<Category, number> = {
  dairy: 7,
  eggs: 28,
  produce_leafy: 5,
  produce_hardy: 14,
  meat_raw: 2,
  meat_cooked: 4,
  seafood: 2,
  bakery: 5,
  canned: 365,
  frozen: 90,
  condiments: 180,
  beverages: 14,
  default: 7,
};

const CATEGORY_KEYWORDS: Array<[Category, readonly string[]]> = [
  [
    "dairy",
    ["milk", "yogurt", "cream", "butter", "cheese", "cottage", "sour"],
  ],
  ["eggs", ["egg", "eggs"]],
  [
    "produce_leafy",
    [
      "lettuce",
      "spinach",
      "kale",
      "arugula",
      "salad",
      "greens",
      "herbs",
      "cilantro",
      "parsley",
      "basil",
      "mint",
    ],
  ],
  [
    "produce_hardy",
    [
      "apple",
      "orange",
      "banana",
      "pear",
      "peach",
      "carrot",
      "potato",
      "onion",
      "cabbage",
      "broccoli",
      "cauliflower",
      "pepper",
      "cucumber",
      "tomato",
      "grape",
      "lemon",
      "lime",
      "melon",
      "squash",
      "pumpkin",
    ],
  ],
  [
    "meat_raw",
    [
      "chicken",
      "beef",
      "pork",
      "turkey",
      "lamb",
      "ground",
      "steak",
      "sausage",
      "bacon",
    ],
  ],
  ["meat_cooked", ["deli", "ham", "salami", "pepperoni", "hotdog", "hot dog"]],
  [
    "seafood",
    ["fish", "salmon", "tuna", "shrimp", "cod", "tilapia", "crab", "lobster"],
  ],
  [
    "bakery",
    ["bread", "bagel", "roll", "muffin", "croissant", "tortilla", "pita", "bun"],
  ],
  ["canned", ["canned", "can ", "jar", "soup", "beans"]],
  ["frozen", ["frozen", "ice cream", "popsicle"]],
  [
    "condiments",
    [
      "ketchup",
      "mustard",
      "mayo",
      "mayonnaise",
      "sauce",
      "dressing",
      "syrup",
      "jam",
      "jelly",
      "honey",
      "peanut butter",
    ],
  ],
  ["beverages", ["juice", "soda", "water", "tea", "coffee", "beer", "wine"]],
];

/**
 * Best-effort category assignment based on keyword matches in the item name.
 * Falls back to `"default"` when nothing matches.
 */
export function categorize(itemName: string): Category {
  const name = itemName.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) return category;
    }
  }
  return "default";
}

/**
 * Days of shelf life for the given item name, using the keyword-based
 * category as an index into `SHELF_LIFE_DAYS`.
 */
export function getShelfLifeDays(itemName: string): number {
  return SHELF_LIFE_DAYS[categorize(itemName)];
}
