import assert from "node:assert/strict";
import { test } from "node:test";
import seed from "../data/restaurants.seed.json";
import { importRestaurants } from "./restaurant-import";

const header = "ID,Name,Area,Address,Cuisine,Mood tags,Typical meal,Serves (people),Typical meal pre-tax,Row status,Hours,Dietary notes";

function csv(...rows: string[][]) {
  return "\uFEFF" + [header, ...rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))].join("\r\n");
}

function row(fields: Record<number, string> = {}) {
  return [
    "campus-pizza", 'Campus "Pizza"', "University Plaza", "160 University Ave W, Waterloo",
    "Pizza", "Quick, Filling", "Small cheese pizza", "1", "CA$7.99",
    "Verified 2026-11-22", "Mon-Fri 11am–4am; Sat-Sun closed", "Vegetarian\nAsk about allergens",
  ].map((value, index) => fields[index] ?? value);
}

test("imports quoted spreadsheet cells, cents, dates and overnight hours", () => {
  const [spot] = importRestaurants(csv(row()), seed);
  assert.equal(spot.name, 'Campus "Pizza"');
  assert.equal(spot.address, "160 University Ave W, Waterloo");
  assert.equal(spot.cuisine, "Pizza");
  assert.equal(spot.dietary_notes, "Vegetarian\nAsk about allergens");
  assert.deepEqual(spot.moods, ["Quick", "Filling"]);
  assert.equal(spot.typical_meal_pre_tax_price_cents, 799);
  assert.equal(spot.serves, 1);
  assert.equal(spot.verified, true);
  assert.equal(spot.price_snapshot_date, "2026-11-22");
  assert.deepEqual(spot.hours, [{ days: [1, 2, 3, 4, 5], opens: 660, closes: 240 }]);
  assert.equal(spot.latitude, seed[0].latitude);
  assert.equal(spot.menu, seed[0].menu);
});

test("a blank price always keeps the row unverified and clears the old snapshot date", () => {
  const [spot] = importRestaurants(csv(row({ 8: "   " })), seed);
  assert.equal(spot.typical_meal_pre_tax_price_cents, null);
  assert.equal(spot.verified, false);
  assert.equal(spot.price_snapshot_date, null);
});

test("only a status starting with Verified can verify a priced row", () => {
  const spots = importRestaurants(csv(row({ 0: "a", 9: "Not Verified" }), row({ 0: "b", 9: "Verified by reviewer" })));
  assert.deepEqual(spots.map(({ verified }) => verified), [false, true]);
});

test("rejects nonnumeric, negative, over-precise and oversized prices", () => {
  for (const price of ["unknown", "-5", "7.999", "8e2", "99999999999999999999"]) {
    assert.throws(() => importRestaurants(csv(row({ 8: price }))), /CSV row 2 .*Typical meal pre-tax/);
  }
});

test("rejects invalid serving counts and duplicate IDs", () => {
  assert.throws(() => importRestaurants(csv(row({ 7: "1.5" }))), /Serves \(people\)/);
  assert.throws(() => importRestaurants(csv(row(), row({ 0: " CAMPUS-PIZZA " }))), /CSV row 3 .*Duplicate ID/);
});

test("preserves the snapshot only for an unchanged meal and price unless a date is supplied", () => {
  const [same] = importRestaurants(csv(row({ 9: "Verified", 10: "" })), seed);
  const [changed] = importRestaurants(csv(row({ 8: "8.25", 9: "Verified" })), seed);
  const [dated] = importRestaurants(csv(row({ 8: "8.25", 9: "Verified" })), seed, "2026-11-21");
  assert.equal(same.price_snapshot_date, seed[0].price_snapshot_date);
  assert.deepEqual(same.hours, seed[0].hours);
  assert.equal(changed.price_snapshot_date, null);
  assert.equal(dated.price_snapshot_date, "2026-11-21");
});

test("new IDs and moved addresses never inherit unverified coordinates", () => {
  const [newSpot] = importRestaurants(csv(row({ 0: "new-id" })), seed);
  const [moved] = importRestaurants(csv(row({ 3: "New address" })), [{ ...seed[0], address: "Old address" }]);
  assert.equal(newSpot.verified, true);
  assert.equal(newSpot.latitude, null);
  assert.equal(moved.longitude, null);
  assert.equal(moved.menu, null);
});
