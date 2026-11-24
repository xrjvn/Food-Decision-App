import { parse } from "csv-parse/sync";
import { LATITUDE, LONGITUDE, parseCoordinate } from "./coordinates";

const STATUS = "Geocode status";

export type Candidate = {
  name?: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    country_code?: string;
    house_number?: string;
    road?: string;
  };
};

const streetWords: Record<string, string> = {
  ave: "avenue", st: "street", rd: "road", dr: "drive", blvd: "boulevard",
  pl: "place", cres: "crescent", ct: "court", ln: "lane", hwy: "highway",
  n: "north", s: "south", e: "east", w: "west",
};

function streetName(value: string) {
  return value.toLowerCase().replace(/\./g, "").trim().split(/\s+/)
    .map((word) => streetWords[word] ?? word).join(" ");
}

function inWaterloo({ address }: Candidate) {
  return address?.country_code === "ca" && address.state?.toLowerCase() === "ontario"
    && (address.city ?? address.town ?? address.municipality)?.toLowerCase() === "waterloo";
}

function businessName(value: string) {
  return value.replace(/\s*\([^)]*\)\s*$/, "").toLowerCase()
    .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function matchAddress(address: string, candidates: Candidate[], name: string) {
  if (!candidates.length) return { status: "Unmatched address" };
  const local = candidates.filter(inWaterloo);
  if (!local.length) return { status: "Outside Waterloo or municipality unconfirmed" };

  const street = address.match(/^\s*(\d+[a-z]?)\s+([^,]+)/i);
  if (!street) return { status: "Unmatched street address" };
  const [, number, streetText] = street;
  const normalized = streetName(streetText);
  const matches = local.filter(({ lat, lon, address }) => {
    if (!address?.road || address.house_number?.toLowerCase() !== number.toLowerCase()) return false;
    const road = streetName(address.road);
    const sameStreet = normalized === road || normalized.startsWith(road + " waterloo")
      || normalized.startsWith(road + " unit ") || normalized.startsWith(road + " suite ");
    return sameStreet && parseCoordinate(lat, 90) !== null && parseCoordinate(lon, 180) !== null;
  });
  const unique = new Map(matches.map((match) => [`${match.lat},${match.lon}`, match]));
  if (!unique.size) return { status: "Unmatched street address" };
  const candidatesAtAddress = [...unique.values()];
  const named = candidatesAtAddress.filter((candidate) => candidate.name
    && businessName(candidate.name) === businessName(name));
  const [match] = named.length === 1 ? named : candidatesAtAddress;
  if (unique.size > 1 && named.length !== 1) return { status: "Ambiguous address" };
  return { status: "Matched (OpenStreetMap)", match };
}

function csvLine(values: string[]) {
  return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(",");
}

export async function geocodeRestaurants(csv: string, lookup: (address: string) => Promise<Candidate[]>) {
  let columns: string[] = [];
  const rows: Record<string, string>[] = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    columns: (header: string[]) => {
      columns = header.map((value) => value.trim());
      if (!columns.includes("Address") || new Set(columns).size !== columns.length) {
        throw new Error('Expected an "Address" column and unique column names.');
      }
      return columns;
    },
  });
  if (!columns.length) throw new Error("The CSV has no header.");
  for (const column of [LATITUDE, LONGITUDE, STATUS]) {
    if (!columns.includes(column)) columns.push(column);
  }

  let flagged = 0;
  let filled = 0;
  for (const row of rows) {
    const latitude = row[LATITUDE]?.trim() ?? "";
    const longitude = row[LONGITUDE]?.trim() ?? "";
    if (latitude || longitude) {
      const valid = parseCoordinate(latitude, 90) !== null && parseCoordinate(longitude, 180) !== null;
      row[STATUS] = valid ? row[STATUS]?.trim() || "Existing coordinates" : "Check existing coordinates";
      if (!valid) flagged++;
      continue;
    }
    const address = row.Address.trim();
    if (!address) {
      row[STATUS] = "Missing address";
      flagged++;
      continue;
    }
    const result = matchAddress(address, await lookup(address), row.Name ?? "");
    row[STATUS] = result.status;
    if (result.match) {
      row[LATITUDE] = result.match.lat;
      row[LONGITUDE] = result.match.lon;
      filled++;
    } else {
      flagged++;
    }
  }
  const output = [csvLine(columns), ...rows.map((row) => csvLine(columns.map((column) => row[column] ?? "")))];
  return { csv: output.join("\r\n") + "\r\n", filled, flagged };
}
