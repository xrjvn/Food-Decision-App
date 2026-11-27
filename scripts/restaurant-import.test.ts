import assert from "node:assert/strict";
import { test } from "node:test";
import { importRestaurants } from "./restaurant-import";
import { rankSpots } from "../app/ranking";

const seed = [{
  "id": "campus-pizza",
  "name": "Campus Pizza",
  "meal": "Small cheese pizza",
  "area": "University Plaza",
  "moods": [
    "Quick",
    "Filling"
  ],
  "menu": "https://campuspizza-alpha.vercel.app/menu",
  "hours": [
    {
      "days": [
        0,
        1,
        2,
        3,
        4,
        5,
        6
      ],
      "opens": 660,
      "closes": 240
    }
  ],
  "hoursSource": "https://campuspizza-alpha.vercel.app/contact",
  "latitude": 43.4719,
  "longitude": -80.5378,
  "typical_meal_pre_tax_price_cents": 799,
  "serves": 1,
  "deal": null,
  "verified": true,
  "price_snapshot_date": "2026-11-22"
}];

const header = "ID,Name,Area,Address,Cuisine,Mood tags,Typical meal,Serves (people),Typical meal pre-tax,Row status,Hours,Dietary notes,Cheapest complete meal,Cheapest meal pre-tax,Price source,Price date checked,Price confidence";

function csv(...rows: string[][]) {
  return "\uFEFF" + [header, ...rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))].join("\r\n");
}

function row(fields: Record<number, string> = {}) {
  return [
    "campus-pizza", 'Campus "Pizza"', "University Plaza", "160 University Ave W, Waterloo",
    "Pizza", "Quick, Filling", "Small cheese pizza", "1", "CA$7.99",
    "Verified 2026-11-22", "Mon-Fri 11am–4am; Sat-Sun closed", "Vegetarian\nAsk about allergens",
    "Small cheese pizza", "7.99", "Restaurant menu", "", "High",
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
  const [spot] = importRestaurants(csv(row({ 13: "   " })), seed);
  assert.equal(spot.cheapest_meal_pre_tax_price_cents, null);
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
  const [changed] = importRestaurants(csv(row({ 13: "8.25", 9: "Verified" })), seed);
  const [dated] = importRestaurants(csv(row({ 13: "8.25", 9: "Verified" })), seed, "2026-11-21");
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

test("reads optional Latitude and Longitude and prefers them over existing seed coordinates", () => {
  const source = csv([...row(), "43.47", "-80.54"]).replace(header, header + ",Latitude,Longitude");
  const [spot] = importRestaurants(source, seed);
  assert.deepEqual([spot.latitude, spot.longitude], [43.47, -80.54]);
  assert.throws(() => importRestaurants(source.replace("-80.54", "")), /Latitude and Longitude must both/);
  assert.throws(() => importRestaurants(source.replace("43.47", "91")), /Latitude and Longitude must both/);
});


test("keeps the cheapest meal separate and prefers the explicit price-check date", () => {
  const source = csv(row({ 8: "", 12: "Soup and bread", 13: "5.50", 15: "2026-11-23" }))
    .replace(",Cheapest meal pre-tax,", ',"Cheapest meal, pre-tax",');
  const [spot] = importRestaurants(source, seed);
  assert.equal(spot.verified, true);
  assert.equal(spot.meal, "Small cheese pizza");
  assert.equal(spot.cheapest_meal, "Soup and bread");
  assert.equal(spot.cheapest_meal_pre_tax_price_cents, 550);
  assert.equal(spot.price_snapshot_date, "2026-11-23");
  assert.equal(spot.price_source, "Restaurant menu");
  assert.equal(spot.price_confidence, "High");
  assert.throws(() => importRestaurants(csv(row({ 13: "unknown" }))), /Cheapest meal pre-tax/);
});

test("a blank schedule can mean unknown hours, while an explicit closure stays known", () => {
  const [unknown, closed] = importRestaurants(csv(
    row({ 0: "unknown", 10: "" }),
    row({ 0: "closed", 10: "Daily closed" }),
  ));
  assert.deepEqual(unknown.hours, []);
  assert.equal(unknown.hours_unknown, true);
  assert.deepEqual(closed.hours, []);
  assert.equal(closed.hours_unknown, false);
});

test("Daily 00:00-24:00 imports as continuously open through midnight", () => {
  const [record] = importRestaurants(csv(row({ 10: "Daily 00:00-24:00" })));
  assert.deepEqual(record.hours, [{ days: [0, 1, 2, 3, 4, 5, 6], opens: 0, closes: 1440 }]);
  assert.throws(() => importRestaurants(csv(row({ 10: "Daily 24:00-02:00" }))), /Invalid time/);
  const spot = { ...record, point: [43.47, -80.54] as const, priceCents: 799 };
  for (const timestamp of ["2026-11-25T04:59:00Z", "2026-11-25T05:00:00Z"]) {
    const result = rankSpots([spot], {
      origin: spot.point, mood: "Anything", budgetCents: 1500, now: new Date(timestamp),
    });
    assert.equal(result.picks.length, 1);
  }
});

test("delivery-app prices enter the eligible seed and explicit menu links override old links", () => {
  const data = csv([...row({ 9: "Third-party price (delivery app)" }), "https://example.com/order"])
    .replace(header, header + ",Menu link");
  const [spot] = importRestaurants(data, seed);
  assert.equal(spot.verified, true);
  assert.equal(spot.deliveryAppPrice, true);
  assert.equal(spot.menu, "https://example.com/order");
  assert.throws(() => importRestaurants(data.replace("https://example.com/order", "javascript:alert(1)")), /Menu link/);
  assert.equal(importRestaurants(csv(row({ 9: "Third-party price (delivery app)", 13: "" })))[0].verified, false);
  for (const status of ["Ready to verify", "Needs price", "Needs name check", "Closed"]) {
    assert.equal(importRestaurants(csv(row({ 9: status })))[0].verified, false);
  }
});

test("multiple windows for the same day preserve a midday closure", () => {
  const [record] = importRestaurants(csv(row({
    10: "Mon-Fri 11:30-15:00; Mon-Fri 16:00-22:00; Sat 12:00-15:00; Sat 16:00-22:00; Sun 12:00-15:00; Sun 16:00-21:00",
  })));
  assert.equal(record.hours.length, 6);
  assert.equal(record.hours_unknown, false);
  const spot = { ...record, point: [43.47, -80.54] as const, priceCents: 799 };
  for (const [time, expected] of [["14:59", 1], ["15:00", 0], ["15:59", 0], ["16:00", 1]] as const) {
    const result = rankSpots([spot], {
      origin: spot.point, mood: "Anything", budgetCents: 1500, now: new Date(`2026-11-27T${time}:00-05:00`),
    });
    assert.equal(result.picks.length, expected);
  }
});
