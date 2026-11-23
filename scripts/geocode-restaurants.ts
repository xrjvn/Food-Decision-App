import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, parse as parsePath, resolve } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { parseArgs } from "node:util";
import { geocodeRestaurants, type Candidate } from "./restaurant-geocode";

const endpoint = "https://nominatim.openstreetmap.org/search";
const userAgent = "FoodDecisionApp-Restaurants-Geocoder/1.0 (+https://github.com/xrjvn/Food-Decision-App)";

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string" },
      cache: { type: "string", default: ".nominatim-cache.jsonl" },
    },
  });
  if (positionals.length !== 1) {
    throw new Error("Usage: npm run geocode:restaurants -- Restaurants.csv [--output PATH] [--cache PATH]");
  }

  const [input] = positionals;
  const { dir, name } = parsePath(input);
  const output = values.output ?? join(dir, `${name}.geocoded.csv`);
  const cachePath = values.cache;
  if (new Set([input, output, cachePath].map((file) => resolve(file))).size !== 3) {
    throw new Error("Input, output and cache must use separate files.");
  }
  if (existsSync(output)) throw new Error(`Output already exists: ${output}`);

  const cache = new Map<string, Candidate[]>();
  if (existsSync(cachePath)) {
    for (const line of readFileSync(cachePath, "utf8").split("\n").filter((line) => line.trim())) {
      const { query, candidates } = JSON.parse(line);
      cache.set(query, candidates);
    }
  }

  let nextRequestAt = 0;
  async function lookup(address: string) {
    const query = address.replace(/\s+/g, " ");
    const key = query.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;

    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      countrycodes: "ca",
      "accept-language": "en",
      limit: "5",
    }).toString();

    await wait(Math.max(0, Math.ceil(nextRequestAt - performance.now())));
    nextRequestAt = performance.now() + 1000;
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");
      throw new Error(`Nominatim returned HTTP ${response.status} for "${address}". Cached results were kept.${retryAfter ? ` Retry-After: ${retryAfter}.` : ""}`);
    }
    const candidates: Candidate[] = await response.json();
    if (!Array.isArray(candidates)) throw new Error("Unexpected Nominatim response.");
    appendFileSync(cachePath, JSON.stringify({ query: key, candidates }) + "\n");
    cache.set(key, candidates);
    return candidates;
  }

  const result = await geocodeRestaurants(readFileSync(input, "utf8"), lookup);
  writeFileSync(output, result.csv, { flag: "wx" });
  console.log(`Wrote ${output}: ${result.filled} filled, ${result.flagged} flagged for review.`);
  console.log("Geocoding data © OpenStreetMap contributors: https://www.openstreetmap.org/copyright");
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
