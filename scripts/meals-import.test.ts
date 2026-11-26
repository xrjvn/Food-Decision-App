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
  assert.deepEqual(result.report.map((row) => row.at(-1)), ["", "Restaurant is not eligible in the Restaurants seed.",
    "Meal row is not verified.", "Pre-tax price is blank."]);
  assert.equal(result.blankRows, 1);
});

test("imports a delivery-app meal when the parent restaurant is eligible", () => {
  const csv = [
    "Meal ID,Restaurant ID,Restaurant,Tier,Meal,Pre-tax price,Serves (people),Price source,Price date checked,Price confidence,Row status,Notes,Meal period",
    "M1,R1,Example,Value,Wrap,9,1,Menu,,Medium,Third-party price (delivery app),,Any time",
  ].join("\n");
  assert.equal(importMeals(csv, [{ id: "R1", verified: true }]).meals[0].deliveryAppPrice, true);
  assert.equal(importMeals(csv, [{ id: "R1", verified: false }]).meals.length, 0);
});

test("imports meal-level craving and diet under either Diet header and reports invalid labels", () => {
  for (const dietHeader of ["Diet", "Diet (my judgment from item name)"]) {
    const csv = [
      `Meal ID,Restaurant ID,Restaurant,Tier,Meal,Pre-tax price,Serves (people),Price source,Price date checked,Price confidence,Row status,Notes,Meal period,Craving,${dietHeader},Helper`,
      "M1,R1,Example,Value,Tea,5,1,Menu,,High,Verified online,,Any time,Dessert/Drink,Vegetarian,unused",
      "M2,R1,Example,Value,Wrap,9,1,Menu,,High,Verified online,,Any time,Meal,Meat,unused",
      "M3,R1,Example,Value,Fries,3,1,Menu,,High,Verified online,,Any time,Late night,Vegetarian,unused",
    ].join("\n");
    const result = importMeals(csv, [{ id: "R1", verified: true }]);
    assert.deepEqual(result.meals.map(({ craving, diet }) => [craving, diet]), [["Dessert/Drink", "Vegetarian"]]);
    assert.match(result.report[1].at(-1) ?? "", /^Diet must be/);
    assert.match(result.report[2].at(-1) ?? "", /^Craving must be/);
  }
});

test("imports optional nutrition, preserves zero and decimal grams, and reports malformed amounts", () => {
  const csv = [
    "Meal ID,Restaurant ID,Restaurant,Tier,Meal,Pre-tax price,Serves (people),Price source,Price date checked,Price confidence,Row status,Notes,Meal period,Main protein,Calories,Protein (g)",
    "M1,R1,Example,Typical,Bowl,9,1,Menu,,High,Verified online,,Any time,Chicken and beans,580,29.5",
    "M2,R1,Example,Value,Tea,5,1,Menu,,High,Verified online,,Any time,,0,0",
    "M3,R1,Example,Value,Wrap,9,1,Menu,,High,Verified online,,Any time,,unknown,",
    "M4,R1,Example,Value,Salad,9,1,Menu,,High,Verified online,,Any time,,200,-1",
    "M5,R1,Example,Value,Cookie,3,1,Menu,,High,Verified online,,Any time,,,",
  ].join("\n");
  const { meals, report } = importMeals(csv, [{ id: "R1", verified: true }]);
  assert.deepEqual(meals.map(({ mainProtein, calories, proteinGrams }) => [mainProtein, calories, proteinGrams]),
    [["Chicken and beans", 580, 29.5], [undefined, 0, 0], [undefined, undefined, undefined]]);
  assert.match(report[2].at(-1) ?? "", /^Calories must be/);
  assert.match(report[3].at(-1) ?? "", /^Protein \(g\) must be/);
});
