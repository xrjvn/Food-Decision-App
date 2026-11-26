import assert from "node:assert/strict";
import { test } from "node:test";
import { campuses } from "./catalogue";
import { distanceMetres, nextWalkLimit, requestLocation, type Point } from "./location";
import { directionsUrl, reportPriceUrl } from "./outbound-links";
import { rankSpots, type RankingSpot } from "./ranking";

const campusPoints = Object.values(campuses).map(({ point }) => point);
const origin = campuses.uw.point;
const destination = { id: "R01", point: campuses.laurier.point };
const search = { origin, mood: "Anything", budgetCents: 1500, now: new Date("2026-11-24T17:30:00Z") };

function fakePosition(latitude: number, longitude: number) {
  return {
    getCurrentPosition(success: PositionCallback) {
      success({ coords: { latitude, longitude } } as GeolocationPosition);
    },
  };
}

test("straight-line distance is symmetric, zero at the same point and accurate at one degree", () => {
  assert.equal(distanceMetres(origin, origin), 0);
  assert.equal(distanceMetres(origin, destination.point), distanceMetres(destination.point, origin));
  assert.ok(Math.abs(distanceMetres([0, 0], [1, 0]) - 111195) < 2);
});

test("walking limits apply to derived distances and widen only when asked", () => {
  const options: RankingSpot[] = ["near", "medium", "far", "outside"].map(id => ({
    id, name: id, meal: id, priceCents: 700, point: origin, moods: [],
    hours: [{ days: [2], opens: 0, closes: 1440 }],
  }));
  const distances = new Map([["near", 307], ["medium", 615], ["far", 923], ["outside", 924]]);
  for (const [limit, count] of [[5, 1], [10, 2], [15, 3]] as const) {
    const result = rankSpots(options, { ...search, walkLimit: limit, distances });
    assert.equal(result.picks.length, count);
    assert.equal(result.picks.at(-1)?.walkMinutes, limit);
  }
  const previousTenMinuteDistance = new Map([["medium", 800]]);
  const withDetour = rankSpots(options, { ...search, walkLimit: 15, distances: previousTenMinuteDistance });
  assert.equal(withDetour.picks[0]?.walkMinutes, 13);
  assert.deepEqual(rankSpots(options, { ...search, walkLimit: 10, distances: previousTenMinuteDistance }).picks, []);
  const distantOnly = rankSpots(options.slice(2), { ...search, walkLimit: 10, distances });
  assert.deepEqual(distantOnly.picks, []);
  assert.equal(nextWalkLimit(5, 1), 10);
  assert.equal(nextWalkLimit(10, 2), 15);
  assert.equal(nextWalkLimit(10, 3), undefined);
  assert.equal(nextWalkLimit(15, 0), 20);
  assert.equal(nextWalkLimit(20, 0), undefined);
  assert.equal(rankSpots(options, { ...search, walkLimit: 20, distances }).picks.length, 4);
});

test("insecure, unavailable, denied and far-away requests supply no location for ranking", () => {
  const noPrompt = { getCurrentPosition: () => assert.fail("The browser should not be prompted") };
  const fail = (code: number) => ({
    getCurrentPosition(_success: PositionCallback, error: PositionErrorCallback) {
      error({ code } as GeolocationPositionError);
    },
  });
  for (const [secure, geolocation, kind] of [
    [false, noPrompt, "insecure"],
    [true, undefined, "unavailable"],
    [true, fail(1), "denied"],
    [true, fail(2), "unavailable"],
    [true, fail(3), "unavailable"],
    [true, fakePosition(44, -81), "too-far"],
  ] as const) {
    requestLocation(secure, geolocation, campusPoints, [destination], result => {
      assert.deepEqual(result, { kind });
    });
  }

  const campusSpot: RankingSpot = {
    id: "campus", name: "Campus", meal: "Lunch", priceCents: 900, point: origin, moods: [],
    hours: [{ days: [2], opens: 0, closes: 1440 }],
  };
  assert.equal(rankSpots([campusSpot], { ...search, walkLimit: 10 }).picks[0]?.id, "campus");
});

test("location returns only distances and never transmits, persists or logs the position", (t) => {
  const point: Point = [43.4701234, -80.5412345];
  const prohibit = () => assert.fail("Location must stay in page memory");
  const fetchSpy = t.mock.method(globalThis, "fetch", prohibit);
  const logSpies = (["log", "warn", "error"] as const).map((method) => t.mock.method(console, method, prohibit));
  for (const key of ["localStorage", "sessionStorage", "indexedDB"]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, get: prohibit });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  requestLocation(true, fakePosition(...point), campusPoints, [destination], result => {
    assert.equal(result.kind, "located");
    if (result.kind !== "located") return;
    assert.deepEqual([...result.distances], [[destination.id, distanceMetres(point, destination.point)]]);
    assert.deepEqual(Object.keys(result), ["kind", "distances"]);
    const report = new URL(reportPriceUrl("Example Café"));
    const directions = new URL(directionsUrl("Example Café", "123 University Ave"));
    assert.ok([...report.searchParams.values()].includes("Example Café"));
    assert.equal(directions.searchParams.has("origin"), false);
    for (const coordinate of point) {
      assert.ok(!report.href.includes(String(coordinate)));
      assert.ok(!directions.href.includes(String(coordinate)));
      assert.ok(!JSON.stringify([...result.distances]).includes(String(coordinate)));
    }
  });
  assert.equal(fetchSpy.mock.callCount(), 0);
  assert.ok(logSpies.every(spy => spy.mock.callCount() === 0));
});
