import { parse } from "csv-parse/sync";
import { mealPeriods, mealTiers, type MealOption } from "../app/meals";
import { isoDate, priceCents, servings } from "./restaurant-import";

const columns = [
  "Meal ID", "Restaurant ID", "Restaurant", "Tier", "Meal", "Pre-tax price", "Serves (people)",
  "Price source", "Price date checked", "Price confidence", "Row status", "Notes", "Meal period",
] as const;

type Row = Record<typeof columns[number], string>;
type Restaurant = { id: string; verified: boolean };

function choice<T extends string>(value: string, choices: readonly T[], column: string): T {
  const match = choices.find((entry) => entry === value);
  if (!match) throw new Error(`${column} must be one of ${choices.join(", ")}.`);
  return match;
}

export function importMeals(csv: string, restaurants: readonly Restaurant[]) {
  const restaurantStatus = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant.verified]));
  const rows: Row[] = parse(csv, {
    bom: true,
    trim: true,
    skip_empty_lines: true,
    columns: (headers: string[]) => {
      for (const name of columns) {
        if (headers.filter((header) => header === name).length !== 1) throw new Error(`Expected one "${name}" column.`);
      }
      return headers;
    },
  });
  const meals: MealOption[] = [];
  const report: string[][] = [];
  const seen = new Set<string>();
  let blankRows = 0;
  for (const raw of rows) {
    const row = Object.fromEntries(columns.map((column) => [column, raw[column].trim()])) as Row;
    if (columns.every((column) => !row[column])) {
      blankRows++;
      continue;
    }
    const id = row["Meal ID"];
    const restaurantId = row["Restaurant ID"];
    let reason = "";
    try {
      if (!id || !row.Meal) throw new Error("Meal ID and Meal are required.");
      if (seen.has(id.toLowerCase())) throw new Error("Duplicate Meal ID.");
      seen.add(id.toLowerCase());
      if (!restaurantStatus.has(restaurantId)) throw new Error("Restaurant ID not found in the Restaurants seed.");
      if (!restaurantStatus.get(restaurantId)) throw new Error("Restaurant is not verified in the Restaurants seed.");
      if (!row["Row status"].startsWith("Verified")) throw new Error("Meal row is not verified.");

      const cents = priceCents(row["Pre-tax price"], "Pre-tax price");
      if (cents === null) throw new Error("Pre-tax price is blank.");
      const priceDate = row["Price date checked"] || null;
      if (priceDate && !isoDate(priceDate)) throw new Error("Price date checked must be a valid YYYY-MM-DD date.");
      meals.push({
        id, restaurantId, meal: row.Meal,
        tier: choice(row.Tier, mealTiers, "Tier"),
        period: choice(row["Meal period"], mealPeriods, "Meal period"),
        priceCents: cents,
        serves: servings(row["Serves (people)"]) ?? 1,
        priceDate,
        priceSource: row["Price source"],
        priceConfidence: row["Price confidence"],
        notes: row.Notes,
      });
    } catch (error) {
      reason = (error as Error).message;
    }
    report.push([id, restaurantId, row.Restaurant, row.Tier, row.Meal, row["Meal period"], reason ? "Skipped" : "Imported", reason]);
  }
  return { meals, report, blankRows };
}
