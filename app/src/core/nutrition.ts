// Calorie and macro goals (static formulas), daily totals and a small built-in food list.

import { FoodEntry, FoodItem, Meal, Profile } from './types';

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
];

const ACTIVITY_FACTOR: Record<Profile['activity'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  'very-active': 1.9,
};

export interface MacroGoals {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Mifflin–St Jeor BMR × activity factor, ±500 kcal for the goal.
 * Protein 1.8 g/kg (2.2 when losing), fat 27 % of calories, carbs fill the rest.
 */
export function macroGoals(p: Profile): MacroGoals {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[p.activity];
  const kcal = Math.round(tdee + (p.goal === 'lose' ? -500 : p.goal === 'gain' ? 300 : 0));
  const protein = Math.round(p.weightKg * (p.goal === 'lose' ? 2.2 : 1.8));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, carbs, fat };
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function entryTotals(e: FoodEntry): Totals {
  const f = e.grams / 100;
  return { kcal: e.food.kcal * f, protein: e.food.protein * f, carbs: e.food.carbs * f, fat: e.food.fat * f };
}

export function dayTotals(entries: FoodEntry[], date: string, meal?: Meal): Totals {
  const t: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries) {
    if (e.date !== date || (meal && e.meal !== meal)) continue;
    const x = entryTotals(e);
    t.kcal += x.kcal;
    t.protein += x.protein;
    t.carbs += x.carbs;
    t.fat += x.fat;
  }
  return t;
}

// Approximate generic values per 100 g (raw unless stated).
const RAW: [string, number, number, number, number][] = [
  ['Chicken breast, cooked', 165, 31, 0, 3.6],
  ['Chicken thigh, cooked', 209, 26, 0, 10.9],
  ['Salmon, cooked', 206, 22, 0, 12.4],
  ['Tuna, canned in water', 116, 26, 0, 0.8],
  ['Beef, lean ground 90%, cooked', 217, 26, 0, 11.7],
  ['Pork loin, cooked', 242, 27, 0, 14],
  ['Turkey breast, cooked', 135, 30, 0, 1],
  ['Shrimp, cooked', 99, 24, 0.2, 0.3],
  ['Tofu, firm', 144, 17, 3, 9],
  ['Egg, whole', 143, 12.6, 0.7, 9.5],
  ['Egg white', 52, 10.9, 0.7, 0.2],
  ['Greek yogurt, plain nonfat', 59, 10.3, 3.6, 0.4],
  ['Cottage cheese, low fat', 82, 11, 3.4, 2.3],
  ['Milk, semi-skimmed', 50, 3.4, 4.8, 1.8],
  ['Cheddar cheese', 403, 25, 1.3, 33],
  ['Whey protein powder', 400, 80, 8, 6],
  ['Oats, rolled', 389, 16.9, 66, 6.9],
  ['White rice, cooked', 130, 2.7, 28, 0.3],
  ['Brown rice, cooked', 123, 2.7, 25.6, 1],
  ['Pasta, cooked', 158, 5.8, 31, 0.9],
  ['Quinoa, cooked', 120, 4.4, 21.3, 1.9],
  ['Whole wheat bread', 247, 13, 41, 3.4],
  ['White bread', 265, 9, 49, 3.2],
  ['Potato, boiled', 87, 1.9, 20, 0.1],
  ['Sweet potato, baked', 90, 2, 20.7, 0.2],
  ['Lentils, cooked', 116, 9, 20, 0.4],
  ['Chickpeas, cooked', 164, 8.9, 27.4, 2.6],
  ['Black beans, cooked', 132, 8.9, 23.7, 0.5],
  ['Banana', 89, 1.1, 22.8, 0.3],
  ['Apple', 52, 0.3, 13.8, 0.2],
  ['Orange', 47, 0.9, 11.8, 0.1],
  ['Blueberries', 57, 0.7, 14.5, 0.3],
  ['Strawberries', 32, 0.7, 7.7, 0.3],
  ['Avocado', 160, 2, 8.5, 14.7],
  ['Broccoli', 34, 2.8, 6.6, 0.4],
  ['Spinach', 23, 2.9, 3.6, 0.4],
  ['Carrot', 41, 0.9, 9.6, 0.2],
  ['Tomato', 18, 0.9, 3.9, 0.2],
  ['Mixed salad greens', 17, 1.5, 3.3, 0.2],
  ['Bell pepper', 31, 1, 6, 0.3],
  ['Olive oil', 884, 0, 0, 100],
  ['Butter', 717, 0.9, 0.1, 81],
  ['Peanut butter', 588, 25, 20, 50],
  ['Almonds', 579, 21, 21.6, 49.9],
  ['Walnuts', 654, 15.2, 13.7, 65.2],
  ['Dark chocolate 70%', 598, 7.8, 45.9, 42.6],
  ['Honey', 304, 0.3, 82.4, 0],
  ['Granola', 471, 10, 64, 20],
  ['Hummus', 166, 7.9, 14.3, 9.6],
  ['Orange juice', 45, 0.7, 10.4, 0.2],
];

export const BUILT_IN_FOODS: FoodItem[] = RAW.map(([name, kcal, protein, carbs, fat], i) => ({
  id: `builtin-${i}`,
  name,
  kcal,
  protein,
  carbs,
  fat,
  source: 'built-in',
}));

export function searchLocalFoods(query: string, custom: FoodItem[]): FoodItem[] {
  const q = query.trim().toLowerCase();
  const all = [...custom, ...BUILT_IN_FOODS];
  if (!q) return all.slice(0, 12);
  const words = q.split(/\s+/);
  return all.filter((f) => words.every((w) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(w))).slice(0, 30);
}

/** Turns an OpenFoodFacts product object into a FoodItem (per 100 g). Returns null when nutrients are missing. */
export function fromOpenFoodFacts(p: any): FoodItem | null {
  if (!p) return null;
  const n = p.nutriments ?? {};
  const kcal = Number(n['energy-kcal_100g'] ?? (n['energy_100g'] != null ? Number(n['energy_100g']) / 4.184 : NaN));
  if (!isFinite(kcal)) return null;
  const name = String(p.product_name || p.generic_name || 'Unnamed product').trim();
  return {
    id: `off-${p.code ?? p._id ?? name}`,
    name,
    brand: p.brands ? String(p.brands).split(',')[0].trim() : undefined,
    barcode: p.code ? String(p.code) : undefined,
    kcal: Math.round(kcal),
    protein: Math.round(Number(n.proteins_100g ?? 0) * 10) / 10,
    carbs: Math.round(Number(n.carbohydrates_100g ?? 0) * 10) / 10,
    fat: Math.round(Number(n.fat_100g ?? 0) * 10) / 10,
    source: 'openfoodfacts',
  };
}

export function isValidBarcode(code: string): boolean {
  const digits = code.replace(/\s/g, '');
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false;
  // GS1 check digit
  const arr = digits.split('').map(Number);
  const check = arr.pop() as number;
  let sum = 0;
  arr.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
}
