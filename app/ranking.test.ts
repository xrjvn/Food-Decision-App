import assert from "node:assert/strict";
import { test } from "node:test";
import seed from "../data/restaurants.seed.json";
import type { SeedSpot } from "../scripts/restaurant-import";
import { spots as visibleSpots } from "./catalogue";
import { rankSpots, type RankingSpot } from "./ranking";

const search = {
  origin: [43.47, -80.54] as const,
  mood: "Quick",
  budgetCents: 1500,
  now: new Date("2026-11-22T17:00:00Z"), // Sunday noon in Waterloo
};

function spot(id: string, fields: Partial<RankingSpot> = {}): RankingSpot {
  return {
    id,
    name: id,
    meal: "Meal",
    priceCents: 1000,
    point: search.origin,
    moods: [],
    hours: [{ days: [0], opens: 11 * 60, closes: 21 * 60 }],
    ...fields,
  };
}

test("adds Ontario HST in cents and uses the rounded total at the budget boundary", () => {
  const spots = [spot("fits", { priceCents: 884 }), spot("over", { priceCents: 885 })];
  const result = rankSpots(spots, { ...search, budgetCents: 999 });
  assert.deepEqual(result.picks.map(({ id, total }) => [id, total]), [["fits", 999]]);
});

test("uses Waterloo local time and includes opening time but excludes closing time", () => {
  const spots = [spot("opening", { hours: [{ days: [0], opens: 720, closes: 780 }] }),
    spot("closing", { hours: [{ days: [0], opens: 660, closes: 720 }] }),
    spot("weekday-only", { hours: [{ days: [1], opens: 660, closes: 780 }] })];
  assert.deepEqual(rankSpots(spots, search).picks.map(({ id }) => id), ["opening"]);
});

test("carries Saturday overnight hours into Sunday until the closing minute", () => {
  const spots = [spot("late", { hours: [{ days: [6], opens: 1320, closes: 120 }] })];
  assert.equal(rankSpots(spots, { ...search, now: new Date("2026-11-22T06:59:00Z") }).kind, "nearby");
  assert.equal(rankSpots(spots, { ...search, now: new Date("2026-11-22T07:00:00Z") }).kind, "nothing-open");
});

test("widens for an affordable open spot when nearby options are closed or over budget", () => {
  const spots = [spot("closed", { hours: [] }), spot("expensive", { priceCents: 1500 }),
    spot("farther", { point: [43.483, -80.54] })];
  assert.equal(rankSpots(spots, search).kind, "wider");
  assert.deepEqual(rankSpots(spots, search).picks.map(({ id }) => id), ["farther"]);
});

test("asks before displaying over-budget picks and sorts approved options cheapest first", () => {
  const spots = [spot("mood-match", { priceCents: 1800, moods: ["Quick"] }),
    spot("cheaper", { priceCents: 1500, point: [43.483, -80.54] }), spot("closed", { hours: [] })];
  assert.deepEqual(rankSpots(spots, search), { kind: "ask-over-budget", picks: [] });
  const result = rankSpots(spots, { ...search, allowOverBudget: true });
  assert.equal(result.kind, "over-budget");
  assert.deepEqual(result.picks.map(({ id }) => id), ["cheaper", "mood-match"]);
});

test("reports nothing open when even the wider area has no open spots", () => {
  const spots = [spot("closed", { hours: [] }), spot("outside", { point: [43.50, -80.54] })];
  assert.deepEqual(rankSpots(spots, { ...search, allowOverBudget: true }), { kind: "nothing-open", picks: [] });
});

test("skips rejected picks, expands after three re-rolls and reports exhaustion", () => {
  const spots = [spot("a"), spot("b"), spot("c"), spot("near"), spot("far", { point: [43.483, -80.54] })];
  const afterOne = rankSpots(spots, { ...search, rejectedIds: new Set(["a"]) });
  assert.equal(afterOne.kind, "nearby");
  assert.deepEqual(afterOne.picks.map(({ id }) => id), ["b", "c", "near"]);

  const afterThree = rankSpots(spots, { ...search, rejectedIds: new Set(["a", "b", "c"]) });
  assert.equal(afterThree.kind, "wider");
  assert.deepEqual(afterThree.picks.map(({ id }) => id), ["near", "far"]);

  const exhausted = rankSpots(spots, { ...search, rejectedIds: new Set(spots.map(({ id }) => id)) });
  assert.deepEqual(exhausted, { kind: "exhausted", picks: [] });
});

test("an active deal boosts the pick and uses its discounted price with tax", () => {
  const deal = { description: "Combo", source: "https://example.com/menu", verifiedOn: "2026-10-23", priceCents: 900 };
  const spots = [spot("regular"), spot("deal", { priceCents: 1200, deal })];
  const [top] = rankSpots(spots, search).picks;
  assert.equal(top.id, "deal");
  assert.equal(top.total, 1017);
  assert.equal(top.deal, deal);
});

test("expired, stale or out-of-hours deals lose their price, badge and ranking boost", () => {
  const deal = { description: "Combo", source: "https://example.com/menu", priceCents: 800, verifiedOn: "2026-11-20" };
  const inactiveDeals = [
    { ...deal, expiresOn: "2026-11-21" },
    { ...deal, verifiedOn: "2026-10-22" },
    { ...deal, hours: [{ days: [0], opens: 780, closes: 840 }] },
  ];

  for (const inactive of inactiveDeals) {
    const spots = [spot("regular", { priceCents: 1200 }), spot("former-deal", { priceCents: 1200, deal: inactive })];
    const [top, other] = rankSpots(spots, search).picks;
    assert.equal(top.id, "regular");
    assert.equal(other.total, 1356);
    assert.equal(other.deal, undefined);
  }
});

test("prefers a mood match over a slightly closer spot and leaves Anything neutral", () => {
  const spots = [
    spot("closer", { moods: ["Filling"] }),
    spot("mood-match", { point: [43.471, -80.54], moods: ["Quick"] }),
  ];
  assert.equal(rankSpots(spots, search).picks[0].id, "mood-match");
  assert.equal(rankSpots(spots, { ...search, mood: "Anything" }).picks[0].id, "closer");
});

test("penalizes a recent top pick without removing it or overriding a strong mood match", () => {
  const spots = [
    spot("recent", { moods: ["Quick"] }),
    spot("new", { point: [43.471, -80.54] }),
  ];
  const neutral = { ...search, mood: "Anything" };
  assert.equal(rankSpots(spots, neutral).picks[0].id, "recent");
  const recentTopPickIds = ["recent"];
  assert.deepEqual(
    rankSpots(spots, { ...neutral, recentTopPickIds }).picks.map(({ id }) => id),
    ["new", "recent"],
  );
  assert.equal(rankSpots(spots, { ...search, recentTopPickIds }).picks[0].id, "recent");
});


test("only loads verified seed spots that can be ranked and preserves pre-tax pricing", () => {
  const rows: SeedSpot[] = seed;
  const verified = rows.filter((spot) => spot.verified
    && Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude)
    && (spot.cheapest_meal_pre_tax_price_cents === undefined
      ? spot.typical_meal_pre_tax_price_cents !== null
      : spot.cheapest_meal_pre_tax_price_cents !== null && Boolean(spot.cheapest_meal)));
  assert.deepEqual(visibleSpots.map(({ id, priceCents, serves }) => ({ id, priceCents, serves })),
    verified.map(({ id, typical_meal_pre_tax_price_cents, cheapest_meal_pre_tax_price_cents, serves }) => ({
      id, priceCents: typical_meal_pre_tax_price_cents ?? cheapest_meal_pre_tax_price_cents, serves,
    })));
});

test("filters and displays the taxed cheapest complete meal price when supplied", () => {
  const spots = [spot("fits", { priceCents: 1800, cheapestMealPriceCents: 884 }),
    spot("over", { priceCents: 700, cheapestMealPriceCents: 885 })];
  const result = rankSpots(spots, { ...search, budgetCents: 999 });
  assert.deepEqual(result.picks.map(({ id, total }) => [id, total]), [["fits", 999]]);
});

function unconfirmed(id: string, fields: Partial<RankingSpot> = {}) {
  return spot(id, { hours: [], hoursUnknown: true, verifiedPrice: true, ...fields });
}

test("only verified-price spots with coordinates and genuinely unknown hours enter the fallback", () => {
  const result = rankSpots([
    unconfirmed("eligible"),
    unconfirmed("unverified", { verifiedPrice: false }),
    unconfirmed("missing", { point: [NaN, -80.54] }),
    unconfirmed("closed-all-week", { hoursUnknown: false }),
    spot("closed-now", { hours: [{ days: [0], opens: 900, closes: 1000 }] }),
  ], search);
  assert.deepEqual(result.picks, []);
  assert.deepEqual(result.unknownHoursPicks?.map((pick) => pick.id), ["eligible"]);
});

test("fallback is suppressed at three confirmed-open matches and separate below two regardless of mood", () => {
  const unknown = unconfirmed("perfect-mood", { moods: ["Quick"] });
  const two = [spot("first"), spot("second")];
  const result = rankSpots([unknown, ...two], search);
  assert.deepEqual(result.picks.map((pick) => pick.id), ["first", "second"]);
  assert.deepEqual(result.unknownHoursPicks?.map((pick) => pick.id), ["perfect-mood"]);
  assert.ok(result.unknownHoursPicks[0].score > result.picks[0].score);
  assert.equal(rankSpots([...two, spot("third"), unknown], search).unknownHoursPicks, undefined);
});

test("unknown-hours picks obey the active radius and tax-inclusive budget even after over-budget opt-in", () => {
  const nearby = unconfirmed("nearby");
  const expanded = unconfirmed("expanded", { point: [43.483, -80.54] });
  const tooFar = unconfirmed("too-far", { point: [43.50, -80.54] });
  const tooExpensive = unconfirmed("over-with-tax", { cheapestMealPriceCents: 1400 });
  const unknown = [nearby, expanded, tooFar, tooExpensive];
  assert.deepEqual(rankSpots([spot("confirmed"), ...unknown], search).unknownHoursPicks?.map((pick) => pick.id), ["nearby"]);
  assert.deepEqual(rankSpots([spot("expensive", { priceCents: 2000 }), ...unknown], {
    ...search, allowOverBudget: true,
  }).unknownHoursPicks?.map((pick) => pick.id), ["nearby", "expanded"]);
});

test("value fit prefers an affordable typical meal, then uses the cheapest meal when typical exceeds budget after tax", () => {
  const options = [
    spot("cheap", { cheapestMealPriceCents: 500, typicalMealPriceCents: 500 }),
    spot("better-fit", { cheapestMealPriceCents: 700, typicalMealPriceCents: 1300 }),
  ];
  const higher = rankSpots(options, search).picks[0];
  assert.deepEqual([higher.id, higher.total, higher.usesTypicalMeal], ["better-fit", 1469, true]);
  const lower = rankSpots(options, { ...search, budgetCents: 1000 }).picks[0];
  assert.deepEqual([lower.id, lower.total, lower.usesTypicalMeal], ["better-fit", 791, false]);
  const tight = rankSpots(options, { ...search, budgetCents: 790 }).picks[0];
  assert.equal(tight.id, "cheap");
});

test("cheapest first uses tax-inclusive per-person totals and keeps unconfirmed hours separate", () => {
  const shared = spot("shared", { cheapestMealPriceCents: 1800, typicalMealPriceCents: 1600, serves: 2 });
  const solo = spot("solo", { cheapestMealPriceCents: 900, typicalMealPriceCents: 1300 });
  const unknown = unconfirmed("unknown-but-cheaper", { cheapestMealPriceCents: 500 });
  const result = rankSpots([solo, unknown, shared], { ...search, order: "cheapest" });
  assert.deepEqual(result.picks.map(x => [x.id, x.total, x.usesPerPersonPrice]), [
    ["shared", 904, true],
    ["solo", 1017, false],
  ]);
  assert.deepEqual(result.unknownHoursPicks?.map(x => x.id), ["unknown-but-cheaper"]);
});

function option(id: string, tier: import("./meals").MealOption["tier"], priceCents: number,
  fields: Partial<import("./meals").MealOption> = {}) {
  return {
    id, tier, priceCents, restaurantId: "multi", meal: id, serves: 1,
    period: "Any time" as const, priceDate: null, priceSource: "", priceConfidence: "", notes: "",
    ...fields,
  };
}

test("falls back to Value when Typical exceeds budget and honors both modes with two Value rows", () => {
  const restaurant = spot("multi", { mealOptions: [
    option("low", "Value", 600), option("high", "Value", 800), option("typical", "Typical", 950),
  ] });
  const budget = { ...search, budgetCents: 1000 };
  const fit = rankSpots([restaurant], budget).picks[0];
  assert.deepEqual([fit.selectedMeal?.id, fit.total], ["high", 904]);
  const cheap = rankSpots([restaurant], { ...budget, order: "cheapest" }).picks[0];
  assert.deepEqual([cheap.selectedMeal?.id, cheap.total], ["low", 678]);
});

test("both modes use per-person totals and best fit prefers affordable Typical or Big", () => {
  const restaurant = spot("multi", { mealOptions: [
    option("value", "Value", 850), option("typical", "Typical", 1400, { serves: 2 }),
    option("big", "Big", 2500, { serves: 3 }),
  ] });
  const budget = { ...search, budgetCents: 1000 };
  const fit = rankSpots([restaurant], budget).picks[0];
  assert.deepEqual([fit.selectedMeal?.id, fit.total, fit.usesPerPersonPrice], ["big", 942, true]);
  const cheap = rankSpots([restaurant], { ...budget, order: "cheapest" }).picks[0];
  assert.deepEqual([cheap.selectedMeal?.id, cheap.total, cheap.usesPerPersonPrice], ["typical", 791, true]);
});

test("breakfast is available from 06:00 until 11:00 Waterloo time and cannot fall back to the legacy breakfast price", () => {
  const restaurant = spot("multi", { hours: [{ days: [0], opens: 0, closes: 1440 }], mealOptions: [
    option("breakfast", "Value", 700, { period: "Breakfast" }),
  ] });
  for (const [time, expected] of [["05:59", false], ["06:00", true], ["10:59", true], ["11:00", false], ["21:30", false]] as const) {
    for (const order of ["best-fit", "cheapest"] as const) {
      const result = rankSpots([restaurant], { ...search, order, now: new Date(`2026-11-22T${time}:00-05:00`) });
      assert.equal(result.picks[0]?.selectedMeal?.id === "breakfast", expected);
    }
  }
});

test("filters meal options by craving and diet before choosing a price for either ranking mode", () => {
  const restaurant = spot("multi", { mealOptions: [
    option("chicken", "Typical", 750, { craving: "Meal", diet: "Contains meat or fish" }),
    option("salad", "Value", 600, { craving: "Meal", diet: "Vegetarian" }),
    option("mystery", "Value", 400, { craving: "Meal", diet: "Unknown" }),
    option("cookie", "Value", 200, { craving: "Dessert/Drink", diet: "Vegetarian" }),
    option("snack", "Value", 300, { craving: "Snack", diet: "Vegetarian" }),
  ] });
  const legacy = spot("legacy");
  for (const order of ["best-fit", "cheapest"] as const) {
    for (const [craving, diet, expected] of [
      ["Meal", "Meat or fish only", "chicken"],
      ["Meal", "Vegetarian only", "salad"],
      ["Dessert/Drink", "Anything", "cookie"],
      ["Dessert/Drink", "Meat or fish only", undefined],
      ["Snack", "Vegetarian only", "snack"],
    ] as const) {
      const result = rankSpots([restaurant, legacy], { ...search, order, mealFilters: { craving, diet }, allowOverBudget: true });
      assert.deepEqual(result.picks.map((pick) => pick.selectedMeal?.id), expected ? [expected] : []);
    }
  }
  const unfiltered = rankSpots([restaurant], { ...search, order: "cheapest" });
  assert.equal(unfiltered.picks[0]?.selectedMeal?.id, "mystery");
});

test("most protein chooses and ranks affordable meals by known grams and falls back to Big", () => {
  const searchOptions = { ...search, order: "most-protein", budgetCents: 1000 } as const;
  const known = spot("known", { mealOptions: [
    option("unknown-big", "Big", 800),
    option("known-value", "Value", 600, { proteinGrams: 32 }),
    option("over-budget", "Typical", 1000, { proteinGrams: 70 }),
  ] });
  const less = spot("less", { mealOptions: [option("known-less", "Typical", 850, { proteinGrams: 21 })] });
  const zero = spot("zero", { mealOptions: [option("known-zero", "Value", 600, { proteinGrams: 0 })] });
  const big = spot("big", { mealOptions: [option("big", "Big", 650), option("typical", "Typical", 850)] });
  const typical = spot("typical", { mealOptions: [option("typical", "Typical", 850)] });
  assert.deepEqual(rankSpots([typical, big, zero, less, known], searchOptions)
    .picks.map(({ selectedMeal }) => selectedMeal?.id), ["known-value", "known-less", "known-zero", "big", "typical"]);
  const unknown = { ...known, hours: [], hoursUnknown: true, verifiedPrice: true };
  const fallback = rankSpots([big, unknown], searchOptions);
  assert.equal(fallback.picks[0]?.id, "big");
  assert.equal(fallback.unknownHoursPicks?.[0]?.id, "known");
});
