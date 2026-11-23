import { parse } from "csv-parse/sync";
import { LATITUDE, LONGITUDE, parseCoordinate } from "./coordinates";
import type { OpeningWindow, RankingSpot } from "../app/ranking";

const columns = [
  "ID", "Name", "Area", "Address", "Cuisine", "Mood tags", "Typical meal",
  "Serves (people)", "Typical meal pre-tax", "Row status", "Hours", "Dietary notes",
  "Cheapest complete meal", "Cheapest meal pre-tax", "Price source", "Price date checked", "Price confidence",
] as const;

type Row = Record<typeof columns[number], string> & Partial<Record<typeof LATITUDE | typeof LONGITUDE, string>>;

export type SeedSpot = {
  id: string;
  name: string;
  meal: string;
  cheapest_meal?: string;
  cheapest_meal_pre_tax_price_cents?: number | null;
  price_source?: string;
  price_confidence?: string;
  area: string;
  address?: string;
  cuisine?: string;
  dietary_notes?: string;
  moods: string[];
  menu: string | null;
  hours: OpeningWindow[];
  hoursSource: string | null;
  latitude: number | null;
  longitude: number | null;
  typical_meal_pre_tax_price_cents: number | null;
  serves: number | null;
  deal: RankingSpot["deal"] | null;
  verified: boolean;
  price_snapshot_date: string | null;
};

const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isoDate(value: string) {
  const time = Date.parse(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(time)
    && new Date(time).toISOString().slice(0, 10) === value;
}

function priceCents(value: string, column = "Typical meal pre-tax") {
  if (!value) return null;
  const match = value.match(/^(?:CA\$|CAD\s*|\$)?\s*(\d+)(?:\.(\d{1,2}))?$/i);
  if (!match) throw new Error(`${column} must be a non-negative CAD amount with at most two decimals.`);
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error(`${column} is too large.`);
  return cents;
}

function servings(value: string) {
  if (!value) return null;
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1) {
    throw new Error("Serves (people) must be a positive whole number.");
  }
  return number;
}

function minutes(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?$/i);
  if (!match) throw new Error(`Invalid time "${value}".`);
  const [, hourText, minuteText = "00", period] = match;
  const hour = Number(hourText);
  if (period && hour >= 1 && hour <= 12) {
    return (hour % 12 + (period.toLowerCase() === "pm" ? 12 : 0)) * 60 + Number(minuteText);
  }
  if (!period && hour <= 23) return hour * 60 + Number(minuteText);
  throw new Error(`Invalid time "${value}".`);
}

function scheduleDays(value: string) {
  if (/^(daily|every day)$/i.test(value)) return [0, 1, 2, 3, 4, 5, 6];
  return [...new Set(value.split(",").flatMap((group) => {
    const names = group.trim().split(/\s*-\s*/);
    const days = names.map((name) => weekdays.indexOf(name.slice(0, 3).toLowerCase()));
    if (days.length > 2 || days.some((day) => day === -1)) throw new Error(`Invalid weekday "${group}".`);
    const [start, end = start] = days;
    return Array.from({ length: (end - start + 7) % 7 + 1 }, (_, offset) => (start + offset) % 7);
  }))];
}

function parseHours(value: string, previous: OpeningWindow[] = []) {
  if (!value) return previous;
  return value.split(/[;\n]+/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const match = line.match(/^(.+?)[:\s]+(closed|\d.*)$/i);
    if (!match) throw new Error('Hours must use a format such as "Mon-Fri 11am-9pm; Sat-Sun closed".');
    const days = scheduleDays(match[1]);
    if (/^closed$/i.test(match[2])) return [];
    const times = match[2].split(/\s*(?:[-–—]|\bto\b)\s*/i);
    if (times.length !== 2) throw new Error(`Invalid hours "${line}".`);
    return [{ days, opens: minutes(times[0]), closes: minutes(times[1]) }];
  });
}

export function importRestaurants(csv: string, existing: readonly SeedSpot[] = [], snapshotDate?: string): SeedSpot[] {
  if (snapshotDate && !isoDate(snapshotDate)) throw new Error("Snapshot date must be a valid YYYY-MM-DD date.");
  const rows: Row[] = parse(csv, {
    bom: true,
    trim: true,
    skip_empty_lines: true,
    columns: (header: string[]) => {
      const names = header.map((name) => name.trim() === "Cheapest meal, pre-tax" ? "Cheapest meal pre-tax" : name.trim());
      for (const column of columns) {
        if (names.filter((name) => name === column).length !== 1) throw new Error(`Expected exactly one "${column}" column.`);
      }
      for (const column of [LATITUDE, LONGITUDE]) {
        if (names.filter((name) => name === column).length > 1) throw new Error(`Duplicate "${column}" column.`);
      }
      return names;
    },
  });
  if (!rows.length) throw new Error("The CSV has no restaurant rows.");

  const previousById = new Map(existing.map((spot) => [spot.id.toLowerCase(), spot]));
  const ids = new Set<string>();
  return rows.map((raw, index) => {
    const row = Object.fromEntries(columns.map((column) => [column, raw[column].trim()])) as Row;
    const id = row.ID;
    try {
      if (!id || !row.Name) throw new Error("ID and Name are required.");
      const key = id.toLowerCase();
      if (ids.has(key)) throw new Error(`Duplicate ID "${id}".`);
      ids.add(key);

      const previous = previousById.get(key);
      const sameLocation = !previous?.address || previous.address === row.Address;
      const metadata = sameLocation ? previous : undefined;
      const latitudeText = raw[LATITUDE]?.trim() ?? "";
      const longitudeText = raw[LONGITUDE]?.trim() ?? "";
      const hasCoordinates = Boolean(latitudeText || longitudeText);
      const latitude = parseCoordinate(latitudeText, 90);
      const longitude = parseCoordinate(longitudeText, 180);
      if (hasCoordinates && (latitude === null || longitude === null)) {
        throw new Error("Latitude and Longitude must both be valid decimal coordinates.");
      }
      const price = priceCents(row["Typical meal pre-tax"]);
      const cheapestMeal = row["Cheapest complete meal"];
      const cheapestPrice = priceCents(row["Cheapest meal pre-tax"], "Cheapest meal pre-tax");
      const checkedDate = row["Price date checked"];
      if (checkedDate && !isoDate(checkedDate)) throw new Error("Price date checked must be a valid YYYY-MM-DD date.");
      const verified = row["Row status"].startsWith("Verified") && cheapestPrice !== null && Boolean(cheapestMeal);
      const datedStatus = row["Row status"].match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
      if (verified && datedStatus && !isoDate(datedStatus)) throw new Error("Row status contains an invalid snapshot date.");
      const samePrice = metadata?.typical_meal_pre_tax_price_cents === price && metadata.meal === row["Typical meal"];

      const sameCheapest = (metadata?.cheapest_meal_pre_tax_price_cents ?? metadata?.typical_meal_pre_tax_price_cents) === cheapestPrice
        && (metadata?.cheapest_meal ?? metadata?.meal) === cheapestMeal;

      const priceDate = (checkedDate || datedStatus) ?? snapshotDate ?? (sameCheapest ? metadata?.price_snapshot_date : null);

      return {
        id,
        name: row.Name,
        area: row.Area,
        address: row.Address,
        cuisine: row.Cuisine,
        dietary_notes: row["Dietary notes"],
        moods: row["Mood tags"].split(/[,;|]/).map((tag) => tag.trim()).filter(Boolean),
        meal: row["Typical meal"],
        cheapest_meal: cheapestMeal,
        cheapest_meal_pre_tax_price_cents: cheapestPrice,
        price_source: row["Price source"],
        price_confidence: row["Price confidence"],
        serves: servings(row["Serves (people)"]),
        typical_meal_pre_tax_price_cents: price,
        verified,
        price_snapshot_date: verified ? priceDate : null,
        hours: parseHours(row.Hours, metadata?.hours),
        hoursSource: row.Hours ? null : metadata?.hoursSource ?? null,
        menu: metadata?.menu ?? null,
        latitude: hasCoordinates ? latitude : metadata?.latitude ?? null,
        longitude: hasCoordinates ? longitude : metadata?.longitude ?? null,
        deal: samePrice ? metadata.deal : null,
      };
    } catch (error) {
      throw new Error(`CSV row ${index + 2}${id ? ` (${id})` : ""}: ${(error as Error).message}`);
    }
  });
}
