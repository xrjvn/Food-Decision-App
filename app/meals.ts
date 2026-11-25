export const mealTiers = ["Value", "Typical", "Big"] as const;
export const mealPeriods = ["Any time", "Breakfast"] as const;

export type MealOption = {
  id: string;
  restaurantId: string;
  meal: string;
  tier: typeof mealTiers[number];
  period: typeof mealPeriods[number];
  priceCents: number;
  serves: number;
  priceDate: string | null;
  priceSource: string;
  priceConfidence: string;
  notes: string;
};

export function chooseMeal(
  meals: readonly MealOption[],
  minute: number,
  budgetCents: number,
  cheapestFirst: boolean,
  taxed: (priceCents: number) => number,
) {
  const available = meals
    .filter((meal) => meal.period === "Any time" || (minute >= 6 * 60 && minute < 11 * 60))
    .map((meal) => ({ meal, total: Math.round(taxed(meal.priceCents) / meal.serves) }));
  const byPrice = (a: typeof available[number], b: typeof available[number]) =>
    a.total - b.total || a.meal.id.localeCompare(b.meal.id);
  const affordable = available.filter(({ total }) => total <= budgetCents);

  if (cheapestFirst || !affordable.length) return available.sort(byPrice)[0];
  return affordable.sort((a, b) =>
    Number(a.meal.tier === "Value") - Number(b.meal.tier === "Value")
    || b.total - a.total || a.meal.id.localeCompare(b.meal.id)
  )[0];
}
