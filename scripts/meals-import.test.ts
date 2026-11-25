import assert from "node:assert/strict";
import { test } from "node:test";
import { importMeals } from "./meals-import";

test("imports verified restaurant meals, skips invalid rows and ignores the helper column", () => {
  const csv = [
    "Meal ID,Restaurant ID,Restaurant,Tier,Meal,Pre-tax price,Serves (people),Price source,Price date checked,Price confidence,Row status,Notes,Meal period,Helper",
    "M1,R1,Example,Value,Bagel,$8.50,1,Menu,2026-11-23,High,Verified online,Note,Breakfast,999",
    "M2,R2,Example,Big,Pizza,20,2,Menu,,High,Verified online,,Any time,999",
    "M3,R1,Example,Typical,Salad,10,1,Menu,,High,Ready to verify,,Any time,999",
    "M4,R1,Example,Value,Wrap,,1,Menu,,High,Verified online,,Any time,999",
    ",,,,,,,,,,,,,999",
  ].join("\n");
  const result = importMeals(csv, [{ id: "R1", verified: true }, { id: "R2", verified: false }]);
  assert.deepEqual(result.meals.map(({ id, priceCents, period }) => [id, priceCents, period]), [["M1", 850, "Breakfast"]]);
  assert.deepEqual(result.report.map((row) => row.at(-1)), ["", "Restaurant is not verified in the Restaurants seed.",
    "Meal row is not verified.", "Pre-tax price is blank."]);
  assert.equal(result.blankRows, 1);
});
