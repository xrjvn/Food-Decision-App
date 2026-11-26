import { moods, type Mood } from "./catalogue";
import { walkOptions, type WalkLimit } from "./location";
import { rankingOrders, type RankingOrder } from "./ranking";
import { budgetOptions } from "./search-state";

export const locationModes = ["campus", "device"] as const;
const sectionEventTypes = ["ranking_toggle", "hours_fallback_shown"] as const;
const spotEventTypes = ["result_shown", "reroll", "menu_tap", "directions_tap", "report_tap"] as const;
export const pilotEventTypes = [...spotEventTypes, ...sectionEventTypes];
export type SpotEventType = typeof spotEventTypes[number];
type Event = {
  type: SpotEventType;
  restaurantId: string;
  mealId?: string;
  rankPosition: number;
} | { type: typeof sectionEventTypes[number] };

type Context = {
  budget: number;
  mood: Mood;
  rankingMode: RankingOrder;
  locationMode: typeof locationModes[number];
  walkLimitMinutes: WalkLimit;
};

type Identity = { browserId: string; sessionId: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function eventPayload(identity: Identity, context: Context, event: Event) {
  if (typeof identity.browserId !== "string" || typeof identity.sessionId !== "string"
      || !uuid.test(identity.browserId) || !uuid.test(identity.sessionId)) return null;
  if (!budgetOptions.some((budget) => budget === context.budget) ||
      !moods.includes(context.mood) ||
      !rankingOrders.includes(context.rankingMode) ||
      !locationModes.includes(context.locationMode) ||
      !walkOptions.includes(context.walkLimitMinutes)) return null;

  const isSpotEvent = "restaurantId" in event;
  if (isSpotEvent) {
    if (!spotEventTypes.includes(event.type) || typeof event.restaurantId !== "string" || !/^R[0-9]{1,11}$/.test(event.restaurantId) ||
        (event.mealId !== undefined && (typeof event.mealId !== "string" || !/^M[0-9]{1,11}$/.test(event.mealId))) ||
        !Number.isInteger(event.rankPosition) || event.rankPosition < 1 || event.rankPosition > 100) return null;
  } else if (!sectionEventTypes.includes(event.type)) {
    return null;
  }

  return {
    browser_id: identity.browserId,
    session_id: identity.sessionId,
    event_type: event.type,
    restaurant_id: isSpotEvent ? event.restaurantId : null,
    meal_id: isSpotEvent ? event.mealId ?? null : null,
    rank_position: isSpotEvent ? event.rankPosition : null,
    budget: context.budget,
    mood: context.mood,
    ranking_mode: context.rankingMode,
    location_mode: context.locationMode,
    walk_limit_minutes: context.walkLimitMinutes,
  };
}

const browserKey = "campus-bites:pilot-browser";
let visit: Identity | undefined;

function visitIdentity() {
  if (visit) return visit;
  let browserId = crypto.randomUUID();
  try {
    const existing = localStorage.getItem(browserKey);
    if (existing && uuid.test(existing)) browserId = existing as typeof browserId;
    else localStorage.setItem(browserKey, browserId);
  } catch {
    // A blocked storage API still allows counting this visit.
  }
  visit = { browserId, sessionId: crypto.randomUUID() };
  return visit;
}

export const pilotLoggingEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function sendPilotEvents(context: Context, events: readonly Event[]) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!projectUrl || !key || !events.length) return;

  try {
    const endpoint = new URL("/rest/v1/events", projectUrl);
    if (endpoint.protocol !== "https:") return;
    const identity = visitIdentity();
    const payload = events.map((event) => eventPayload(identity, context, event)).filter(Boolean);
    if (!payload.length) return;
    await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Telemetry is best effort and never blocks the meal picker.
  }
}
