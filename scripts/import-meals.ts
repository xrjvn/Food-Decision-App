import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { importMeals } from "./meals-import";

try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { output: { type: "string", default: "data/meals.seed.json" }, report: { type: "string" } },
  });
  if (positionals.length !== 1) throw new Error("Usage: npm run import:meals -- Meals.csv [--output PATH] [--report PATH]");
  const restaurants = JSON.parse(readFileSync("data/restaurants.seed.json", "utf8"));
  const { meals, report, blankRows } = importMeals(readFileSync(positionals[0], "utf8"), restaurants);
  if (!meals.length) throw new Error("No verified meals to write.");
  if (values.report) {
    const header = ["Meal ID", "Restaurant ID", "Restaurant", "Tier", "Meal", "Meal period", "Import result", "Reason"];
    const csv = [header, ...report].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    writeFileSync(values.report, csv + "\r\n");
  }
  const temporary = `${values.output}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(meals, null, 2) + "\n", { flag: "wx" });
  renameSync(temporary, values.output);
  console.log(`Imported ${meals.length} meals. Skipped ${report.length - meals.length} populated rows and ignored ${blankRows} blank rows.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
