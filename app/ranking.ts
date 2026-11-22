type Point = readonly [latitude: number, longitude: number];

export type OpeningWindow = {
  days: readonly number[]; // 0 is Sunday
  opens: number; // Minutes after local midnight
  closes: number;
};

type Deal = {
  description: string;
  source: string;
  verifiedOn: string; // Waterloo calendar date, YYYY-MM-DD
  expiresOn?: string; // Last valid Waterloo calendar date
  hours?: readonly OpeningWindow[];
  priceCents?: number;
};

export type RankingSpot = {
  id: string;
  name: string;
  meal: string;
  priceCents: number;
  point: Point;
  moods: readonly string[];
  hours: readonly OpeningWindow[];
  deal?: Deal;
};

export type RankedPick<Spot extends RankingSpot> = Omit<Spot, "deal"> & {
  deal: Deal | undefined;
  total: number;
  distance: number;
  score: number;
  walkMinutes: number;
};

const ONTARIO_HST = 0.13;
const NEARBY_METRES = 1000;
const EXPANDED_METRES = 2000;
const REROLLS_BEFORE_EXPANDING = 3;
const MAX_DEAL_AGE_DAYS = 30;
const DAY_MS = 86_400_000;
const radians = Math.PI / 180;
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const waterlooTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric", month: "2-digit", day: "2-digit",
  weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function distanceMetres(from: Point, to: Point) {
  const [lat, lon] = from;
  const [targetLat, targetLon] = to;
  const a = Math.sin((targetLat - lat) * radians / 2) ** 2
    + Math.cos(lat * radians) * Math.cos(targetLat * radians)
    * Math.sin((targetLon - lon) * radians / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(a));
}

function isWithinHours(hours: readonly OpeningWindow[], day: number, minute: number) {
  const previousDay = (day + 6) % 7;
  return hours.some(({ days, opens, closes }) => {
    if (closes > opens) return days.includes(day) && minute >= opens && minute < closes;
    if (closes === opens) return false;
    return (days.includes(day) && minute >= opens)
      || (days.includes(previousDay) && minute < closes);
  });
}

function activeDeal(deal: Deal | undefined, date: string, day: number, minute: number) {
  if (!deal || (deal.expiresOn && date > deal.expiresOn)) return undefined;
  const age = (Date.parse(date) - Date.parse(deal.verifiedOn)) / DAY_MS;
  if (!(age >= 0 && age <= MAX_DEAL_AGE_DAYS)) return undefined;
  if (deal.hours && !isWithinHours(deal.hours, day, minute)) return undefined;
  return deal;
}

type Search = {
  origin: Point;
  mood: string;
  budgetCents: number;
  now: Date;
  rejectedIds?: ReadonlySet<string>;
  allowOverBudget?: boolean;
};

type RankingResult<Spot extends RankingSpot> = {
  kind: "nearby" | "wider" | "ask-over-budget" | "over-budget" | "nothing-open" | "exhausted";
  picks: RankedPick<Spot>[];
};

export function rankSpots<Spot extends RankingSpot>(
  spots: readonly Spot[],
  { origin, mood, budgetCents, now, rejectedIds = new Set(), allowOverBudget = false }: Search,
): RankingResult<Spot> {
  const parts = Object.fromEntries(waterlooTime.formatToParts(now).map(({ type, value }) => [type, value]));
  const date = [parts.year, parts.month, parts.day].join("-");
  const day = weekdays.indexOf(parts.weekday);
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const open = spots.flatMap((spot): RankedPick<Spot>[] => {
    const distance = distanceMetres(origin, spot.point);
    if (distance > EXPANDED_METRES || !isWithinHours(spot.hours, day, minute)) return [];

    const deal = activeDeal(spot.deal, date, day, minute);
    const price = deal?.priceCents ?? spot.priceCents;
    const total = price + Math.round(price * ONTARIO_HST);
    const score = Number(spot.moods.includes(mood)) * 12 + Number(Boolean(deal)) * 8 - distance / 100;
    return [{ ...spot, deal, total, distance, score, walkMinutes: Math.max(1, Math.round(distance / 80)) }];
  });

  if (!open.length) return { kind: "nothing-open", picks: [] };
  const remaining = open.filter((spot) => !rejectedIds.has(spot.id));
  if (!remaining.length) return { kind: "exhausted", picks: [] };

  const affordable = remaining.filter((spot) => spot.total <= budgetCents)
    .sort((a, b) => b.score - a.score || a.total - b.total);
  const nearby = affordable.filter((spot) => spot.distance <= NEARBY_METRES);
  if (nearby.length && rejectedIds.size < REROLLS_BEFORE_EXPANDING) {
    return { kind: "nearby", picks: nearby };
  }
  if (affordable.length) return { kind: "wider", picks: affordable };
  if (!allowOverBudget) return { kind: "ask-over-budget", picks: [] };
  return {
    kind: "over-budget",
    picks: remaining.sort((a, b) => a.total - b.total || b.score - a.score),
  };
}
