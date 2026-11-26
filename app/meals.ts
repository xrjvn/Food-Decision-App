export const rankingOrders = ["best-fit", "cheapest", "most-protein"] as const;
export type RankingOrder = typeof rankingOrders[number];

export const mealTiers = ["Value", "Typical", "Big"] as const;
export const mealPeriods = ["Any time", "Breakfast"] as const;

export const cravings = ["Meal", "Snack", "Dessert/Drink"] as const;
export const mealDiets = ["Vegetarian", "Contains meat or fish", "Unknown"] as const;
export const diets = ["Anything", "Meat or fish only", "Vegetarian only"] as const;

export type Craving = typeof cravings[number];
export type Diet = typeof diets[number];
export type MealFilters = { craving: Craving; diet: Diet };

export const defaultMealFilters: MealFilters = { craving: "Meal", diet: "Anything" };

export type MealOption = {
  id: string;
  restaurantId: string;
  meal: string;
  tier: typeof mealTiers[number];
  period: typeof mealPeriods[number];
  craving?: Craving;
  diet?: typeof mealDiets[number];
  mainProtein?: string;
  calories?: number;
  proteinGrams?: number;
  priceCents: number;
  serves: number;
  priceDate: string | null;
  priceSource: string;
  priceConfidence: string;
  notes: string;
  deliveryAppPrice?: boolean;
};

export function availableMealOptions(
  meals: readonly MealOption[],
  minute: number,
  taxed: (priceCents: number) => number,
  { craving, diet }: MealFilters,
) {
  return meals
    .filter((meal) => (meal.craving ?? "Meal") === craving
      && (diet === "Anything" || meal.diet === (diet === "Vegetarian only" ? "Vegetarian" : "Contains meat or fish")))
    .filter((meal) => meal.period === "Any time" || (minute >= 6 * 60 && minute < 11 * 60))
    .map((meal) => ({ meal, total: Math.round(taxed(meal.priceCents) / meal.serves) }));
}

export function compareProtein(a: MealOption | undefined, b: MealOption | undefined) {
  if (a?.proteinGrams !== undefined || b?.proteinGrams !== undefined) {
    return (b?.proteinGrams ?? -1) - (a?.proteinGrams ?? -1);
  }
  return Number(b?.tier === "Big") - Number(a?.tier === "Big");
}

export function chooseMeal(
  meals: readonly MealOption[],
  minute: number,
  budgetCents: number,
  order: RankingOrder,
  taxed: (priceCents: number) => number,
  filters: MealFilters = defaultMealFilters,
) {
  const available = availableMealOptions(meals, minute, taxed, filters);
  const byPrice = (a: typeof available[number], b: typeof available[number]) =>
    a.total - b.total || a.meal.id.localeCompare(b.meal.id);
  const affordable = available.filter(({ total }) => total <= budgetCents);

  if (order === "cheapest" || !affordable.length) return available.sort(byPrice)[0];
  return affordable.sort((a, b) =>
    (order === "most-protein" ? compareProtein(a.meal, b.meal) : 0)
    || Number(a.meal.tier === "Value") - Number(b.meal.tier === "Value")
    || b.total - a.total || a.meal.id.localeCompare(b.meal.id)
  )[0];
}
