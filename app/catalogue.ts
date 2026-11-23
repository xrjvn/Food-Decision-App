import seed from "../data/restaurants.seed.json";
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
  menu: string;
  serves: number;
};

export const spots: readonly Spot[] = seed
  .filter((spot) => spot.verified === true)
  .map(({
    latitude, longitude, typical_meal_pre_tax_price_cents, deal,
    id, name, meal, area, moods, menu, hours, serves,
  }) => ({
    id, name, meal, area, moods, menu, hours, serves,
    point: [latitude, longitude],
    priceCents: typical_meal_pre_tax_price_cents,
    deal: deal ?? undefined,
  }));
