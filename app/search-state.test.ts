import assert from "node:assert/strict";
import { test } from "node:test";
import { campuses } from "./catalogue";
import { rankSpots, type RankingSpot } from "./ranking";
import { initialSearch, updateSearch } from "./search-state";

const options: RankingSpot[] = [800, 1200, 1700].map((priceCents) => ({
  id: String(priceCents),
  name: String(priceCents),
  meal: "Lunch",
  priceCents,
  hours: [{ days: [2], opens: 0, closes: 1440 }],
  point: campuses.uw.point,
  moods: [],
}));

function top(state: typeof initialSearch) {
  const { campus, budget, mood, order } = state.preferences;
  return rankSpots(options, {
    origin: campuses[campus].point, budgetCents: budget * 100, mood, order,
    now: new Date("2026-11-24T17:30:00Z"),
    rejectedIds: state.rejectedIds, recentTopPickIds: state.recentTopPickIds,
    allowOverBudget: state.allowOverBudget,
  }).picks[0]?.id;
}

test("rapid budget actions use the latest queued state even when returning to the starting budget", () => {
  // These actions can all be queued by handlers from the same render.
  const queue = [10, 15, 20, 10, 20, 15, 10, 15].map((budget) => ({
    type: "preference" as const, change: { budget },
  }));
  let state = initialSearch;
  const results = queue.map((action) => {
    state = updateSearch(state, action);
    return top(state);
  });
  assert.deepEqual(results, ["800", "1200", "1700", "800", "1700", "1200", "800", "1200"]);
  assert.equal(state.preferences.budget, 15);
});

test("changing any preference clears re-rolls, novelty and consent and ignores stale actions", () => {
  const preferences = initialSearch.preferences;
  const reject = { type: "reject", id: "1200", preferences } as const;
  const consent = { type: "allow-over-budget", preferences } as const;
  const dirty = updateSearch(updateSearch(initialSearch, reject), consent);
  const changes = [{ budget: 20 }, { mood: "Quick" }, { campus: "laurier" }] as const;
  for (const change of changes) {
    const fresh = updateSearch(dirty, { type: "preference", change });
    assert.deepEqual(fresh.preferences, { ...preferences, ...change });
    assert.equal(fresh.rejectedIds.size, 0);
    assert.deepEqual(fresh.recentTopPickIds, []);
    assert.equal(fresh.allowOverBudget, false);
    assert.equal(updateSearch(updateSearch(fresh, reject), consent), fresh);
  }
});


test("budget ranking toggle switches to cheapest and back to best fit", () => {
  assert.equal(top(initialSearch), "1200");
  const cheapest = updateSearch(initialSearch, { type: "preference", change: { order: "cheapest" } });
  assert.equal(top(cheapest), "800");
  const restored = updateSearch(cheapest, { type: "preference", change: { order: "best-fit" } });
  assert.equal(top(restored), "1200");
});
