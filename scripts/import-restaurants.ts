import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { importRestaurants, type SeedSpot } from "./restaurant-import";

try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", default: "data/restaurants.seed.json" },
      "snapshot-date": { type: "string" },
    },
  });
  if (positionals.length !== 1) {
    throw new Error("Usage: npm run import:restaurants -- Restaurants.csv [--output PATH] [--snapshot-date YYYY-MM-DD]");
  }
  const existing: SeedSpot[] = JSON.parse(readFileSync("data/restaurants.seed.json", "utf8"));
  const seed = importRestaurants(readFileSync(positionals[0], "utf8"), existing, values["snapshot-date"]);
  const temporary = `${values.output}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(seed, null, 2) + "\n", { flag: "wx" });
  renameSync(temporary, values.output);
  console.log(`Wrote ${seed.length} restaurants (${seed.filter((spot) => spot.verified).length} verified) to ${values.output}.`);
  const missingLocation = seed.filter((spot) => spot.verified && spot.latitude === null);
  if (missingLocation.length) {
    console.log(`Add coordinates before these verified spots can appear: ${missingLocation.map((spot) => spot.id).join(", ")}.`);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
