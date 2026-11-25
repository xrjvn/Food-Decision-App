import mealSeed from "../data/meals.seed.json";
import type { MealOption } from "./meals";
import seed from "../data/restaurants.seed.json";
import type { SeedSpot } from "../scripts/restaurant-import";
import type { RankingSpot } from "./ranking";

export const campuses = {
  uw: { name: "University of Waterloo", point: [43.4711, -80.5423] },
  laurier: { name: "Wilfrid Laurier University", point: [43.4739, -80.5275] },
} as const;

export const moods = ["Anything", "Quick", "Filling", "Light", "Treat"] as const;
export type Campus = keyof typeof campuses;
export type Mood = typeof moods[number];

type Spot = RankingSpot & {
  area: string;
  menu: string | null;
  address?: string;
  priceSnapshotDate: string | null;
  serves: number | null;
};

const catalogue: SeedSpot[] = seed;
const meals = mealSeed as readonly MealOption[];
const mealsByRestaurant = new Map<string, MealOption[]>();
for (const meal of meals) {
  const options = mealsByRestaurant.get(meal.restaurantId) ?? [];
  options.push(meal);
  mealsByRestaurant.set(meal.restaurantId, options);
}

export const spots: readonly Spot[] = catalogue
  .filter((spot) => spot.verified === true
    && Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude)
    && (spot.cheapest_meal_pre_tax_price_cents === undefined
      ? spot.typical_meal_pre_tax_price_cents !== null
      : spot.cheapest_meal_pre_tax_price_cents !== null && Boolean(spot.cheapest_meal)))
  .map(({
    latitude, longitude, typical_meal_pre_tax_price_cents, deal,
    cheapest_meal, cheapest_meal_pre_tax_price_cents,
    id, name, meal, area, address, moods, menu, hours, hours_unknown, serves, price_snapshot_date,
  }) => ({
    id, name, meal, area, address, moods, menu, hours, serves,
    priceSnapshotDate: price_snapshot_date,
    mealOptions: mealsByRestaurant.get(id),
    hoursUnknown: hours_unknown ?? hours.length === 0,
    verifiedPrice: true,
    point: [latitude, longitude],
    priceCents: typical_meal_pre_tax_price_cents ?? cheapest_meal_pre_tax_price_cents,
    typicalMealPriceCents: meal ? typical_meal_pre_tax_price_cents ?? undefined : undefined,
    cheapestMeal: cheapest_meal || undefined,
    cheapestMealPriceCents: cheapest_meal_pre_tax_price_cents ?? undefined,
    deal: deal ?? undefined,
  }));
