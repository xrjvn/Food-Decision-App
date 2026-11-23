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

export const spots: readonly Spot[] = catalogue
  .filter((spot) => spot.verified === true
    && Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude)
    && spot.typical_meal_pre_tax_price_cents !== null)
  .map(({
    latitude, longitude, typical_meal_pre_tax_price_cents, deal,
    id, name, meal, area, address, moods, menu, hours, serves, price_snapshot_date,
  }) => ({
    id, name, meal, area, address, moods, menu, hours, serves,
    priceSnapshotDate: price_snapshot_date,
    point: [latitude, longitude],
    priceCents: typical_meal_pre_tax_price_cents,
    deal: deal ?? undefined,
  }));
