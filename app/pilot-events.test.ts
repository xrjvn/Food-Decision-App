import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cravings, diets } from "./meals";
import { moods } from "./catalogue";
import { walkOptions } from "./location";
import { rankingOrders } from "./ranking";
import { minBudget, maxBudget } from "./search-state";
import { test } from "node:test";
import { eventPayload, locationModes, pilotEventTypes, sendPilotEvents } from "./pilot-events";

const identity = {
  browserId: "61d04463-4327-41b9-8dbd-177543fee792",
  sessionId: "42757923-dda5-4a0a-8037-fccf31954493",
};
const context = {
  budget: 15, mood: "Quick", craving: "Snack", diet: "Vegetarian only", rankingMode: "best-fit", locationMode: "device", walkLimitMinutes: 10,
} as const;
const event = { type: "result_shown", restaurantId: "R01", mealId: "M007", rankPosition: 1 } as const;

test("only allowlisted fields reach the insert payload even if callers pass location or other data", () => {
  const input = {
    ...context, latitude: 43.123456, longitude: -80.123456, address: "123 Example St",
    ip: "192.0.2.7", point: [43.123456, -80.123456], distance: 777,
  };
  const richEvent = { ...event, name: "Restaurant name", notes: "arbitrary note", location: input };
  assert.deepEqual(eventPayload(identity, input, richEvent), {
    browser_id: identity.browserId, session_id: identity.sessionId,
    event_type: "result_shown", restaurant_id: "R01", meal_id: "M007", rank_position: 1,
    budget: 15, mood: "Quick", craving: "Snack", diet: "Vegetarian only", ranking_mode: "best-fit", location_mode: "device", walk_limit_minutes: 10,
  });
});

test("coordinate strings and objects are rejected in typed payload fields", () => {
  assert.equal(eventPayload(identity, { ...context, craving: "43.12,-80.12" } as never, event), null);
  assert.equal(eventPayload(identity, { ...context, diet: "123 Example St" } as never, event), null);
  assert.equal(eventPayload(identity, { ...context, locationMode: "43.12,-80.12" } as never, event), null);
  assert.equal(eventPayload(identity, context, { ...event, restaurantId: "43.12,-80.12" }), null);
  assert.equal(eventPayload(identity, context, {
    ...event, mealId: { toString: () => "M001", latitude: 43.12, longitude: -80.12 },
  } as never), null);
});

test("logger does not write or send when configuration is missing", async (t) => {
  const saved = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  t.after(() => { if (saved !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = saved; });
  const fetchSpy = t.mock.method(globalThis, "fetch", async () => assert.fail("Unexpected insert"));
  await sendPilotEvents(context, [event]);
  assert.equal(fetchSpy.mock.callCount(), 0);
});

test("configured logger batches inserts without returning rows or sending browser cookies", async (t) => {
  for (const [key, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-publishable-key"],
  ]) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const stored: [string, string][] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => null, setItem: (key: string, value: string) => stored.push([key, value]),
  } });
  t.after(() => previous
    ? Object.defineProperty(globalThis, "localStorage", previous) : Reflect.deleteProperty(globalThis, "localStorage"));
  const post = t.mock.method(globalThis, "fetch", async (_url, _options) =>
    new Response(null, { status: 201 }));
  const richContext = { ...context, coords: [43.123456, -80.123456] };
  await sendPilotEvents(richContext, [event, { type: "hours_fallback_shown" }]);
  assert.equal(post.mock.callCount(), 1);
  const [url, options] = post.mock.calls[0].arguments as [URL, RequestInit];
  const headers = new Headers(options.headers);
  assert.equal(url.href, "https://example.supabase.co/rest/v1/events");
  assert.equal(options.credentials, "omit");
  assert.equal(headers.get("Prefer"), "return=minimal");
  assert.equal(options.referrerPolicy, "no-referrer");
  const raw = String(options.body);
  const body = JSON.parse(raw);
  assert.equal(body.length, 2);
  assert.equal(body[0].browser_id, stored[0][1]);
  assert.equal(body[0].session_id, body[1].session_id);
  assert.notEqual(body[0].browser_id, body[0].session_id);
  assert.equal(body[0].location_mode, "device");
  assert.ok(!raw.includes("43.123456"));
  assert.equal(stored.length, 1);
  assert.equal(stored[0][0], "campus-bites:pilot-browser");
});

test("the SQL CHECK constraints exactly match app and logger options", () => {
  const sql = readFileSync(new URL("../supabase/events.sql", import.meta.url), "utf8");
  assert.ok(sql.includes(`budget numeric(5,2) not null check (budget between ${minBudget} and ${maxBudget})`));
  for (const [column, values] of Object.entries({
    mood: moods, craving: cravings, diet: diets, walk_limit_minutes: walkOptions,
    ranking_mode: rankingOrders, location_mode: locationModes, event_type: pilotEventTypes,
  })) {
    const match = sql.match(new RegExp(String.raw`check \(${column} in \(([^)]*)\)`));
    assert.ok(match, column);
    const allowed = match[1].split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
    assert.deepEqual(allowed, values.map(String), column);
  }
});

test("rejected, thrown, and HTTP-error inserts all resolve without disrupting the app", async (t) => {
  for (const [key, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-publishable-key"],
  ]) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const post = t.mock.method(globalThis, "fetch", () => Promise.reject(new Error("Offline")));
  await assert.doesNotReject(sendPilotEvents(context, [event]));
  post.mock.mockImplementation(() => { throw new Error("Blocked"); });
  await assert.doesNotReject(sendPilotEvents(context, [event]));
  post.mock.mockImplementation(async () => new Response(null, { status: 403 }));
  await assert.doesNotReject(sendPilotEvents(context, [event]));
  assert.equal(post.mock.callCount(), 3);
});


test("pilot events accept decimal budgets and a twenty-minute limit", () => {
  const custom = { ...context, budget: 12.35, walkLimitMinutes: 20 } as const;
  assert.equal(eventPayload(identity, custom, event)?.budget, 12.35);
  for (const budget of [0, 100.01, 12.345, NaN]) {
    assert.equal(eventPayload(identity, { ...custom, budget }, event), null);
  }
});
