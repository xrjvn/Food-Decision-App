import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "csv-parse/sync";
import { geocodeRestaurants, type Candidate } from "./restaurant-geocode";

const local: Candidate = {
  lat: "43.472",
  lon: "-80.537",
  address: { house_number: "160", road: "University Avenue West", city: "Waterloo", state: "Ontario", country_code: "ca" },
};

test("fills a Waterloo address, preserves CSV cells and skips existing or incomplete coordinates", async () => {
  const lookups: string[] = [];
  const input = 'ID,Address,Latitude,Longitude,Notes\r\na,"160 University Ave W, Waterloo",,,"Note, with comma"\r\nb,Already mapped,43.47,-80.54,\r\nc,Partial,43.47,,\r\n';
  const result = await geocodeRestaurants(input, async (address) => {
    lookups.push(address);
    return [local];
  });
  const rows: Record<string, string>[] = parse(result.csv, { columns: true });
  assert.deepEqual(lookups, ["160 University Ave W, Waterloo"]);
  assert.equal(rows[0].Latitude, "43.472");
  assert.equal(rows[0].Longitude, "-80.537");
  assert.equal(rows[0].Notes, "Note, with comma");
  assert.equal(rows[1].Latitude, "43.47");
  assert.equal(rows[2]["Geocode status"], "Check existing coordinates");
  assert.deepEqual([result.filled, result.flagged], [1, 1]);
});

test("flags outside, unmatched, imprecise, ambiguous and blank addresses without filling coordinates", async () => {
  const input = "ID,Address\na,160 Outside\nb,160 Missing\nc,University Avenue West\nd,160 University Ave W\ne,\n";
  const result = await geocodeRestaurants(input, async (address) => {
    if (address.includes("Outside")) return [{ ...local, address: { ...local.address, city: "Kitchener" } }];
    if (address.includes("Missing")) return [];
    if (address.startsWith("160")) return [local, { ...local, lat: "43.473" }];
    return [local];
  });
  const rows: Record<string, string>[] = parse(result.csv, { columns: true });
  assert.deepEqual(rows.map((row) => row["Geocode status"]), [
    "Outside Waterloo or municipality unconfirmed", "Unmatched address", "Unmatched street address",
    "Ambiguous address", "Missing address",
  ]);
  assert.ok(rows.every((row) => !row.Latitude && !row.Longitude));
  assert.equal(result.flagged, 5);
});

test("uses a unique business name to resolve candidates at the same street address", async () => {
  const csv = "ID,Name,Address\na,Bao Sandwich Bar (Waterloo),160 University Ave W\n";
  const result = await geocodeRestaurants(csv, async () => [
    { ...local, name: "Another restaurant", lat: "43.473" },
    { ...local, name: "Bao Sandwich Bar" },
  ]);
  assert.equal(result.filled, 1);
  assert.equal(result.flagged, 0);
});
