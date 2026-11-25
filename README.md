# Food Decision App

A mobile-first meal picker for the University of Waterloo and Wilfrid Laurier University area.

## Run locally

Use Node.js 20.9 or newer. Run `npm ci` and `npm run dev`, then open the local URL printed by Next.js. Run `npm run build` to create the static preview in `out/`.

## Campus preview

Edit `data/restaurants.seed.json` to maintain the catalogue. Store cheapest complete meal and typical meal pre-tax prices in Canadian cents and use `serves` for the number of people the listed meal feeds. `price_snapshot_date` is the date the menu price was checked (YYYY-MM-DD), or null when unconfirmed. Keep `verified` false until the location, menu price and weekly hours have been checked against the linked sources. Only verified rows enter ranking. Menu prices can still change.

The browser calculates tax-inclusive totals from the cheapest complete meal on new imports and ranks by mood, proximity and active deals. A small penalty for the last three distinct top picks within the current page visit helps introduce variety. Approximate walk times use straight-line distance.

Weekly hours are kept with their sources in the catalogue. The app interprets them in Waterloo time. Holiday exceptions and last-minute closures may differ from the posted schedule.

The ranking starts within 1 km and expands to 2 km after three re-rolls or when no eligible nearby picks remain. Over-budget picks require a separate opt-in. Deals are hidden more than 30 days after verification or when their validity period ends.

Run `npm test` for the ranking unit tests. The static export needs no database or Places API credentials.

## Step 4 plan — delivery estimates

Start after the pickup flow, catalogue maintenance and pilot measurement are working.

- Keep pickup as the default. Add a Delivery toggle and label its results “Estimated delivery total · tip excluded.” Show a range in CAD with a breakdown of the pickup menu price, estimated item markup, delivery fee, service fee and applicable HST. Calculate tax on the applicable components and make the low and high scenarios explicit. Show when the estimate was updated and how many comparable orders informed it. If data is sparse, show that an estimate is unavailable. For budget labels, distinguish a range entirely under budget, one that crosses the budget and one entirely above it.
- Add a voluntary form for a real delivery order. Capture the restaurant, matched item and quantity, platform, approximate order date, coarse campus area, item subtotal, delivery fee, service fee, other fees, HST, discounts and paid total. Capture tip separately so the order can be compared with the tip-excluded estimate. Keep currency in CAD, validate that the amounts reconcile, and collect no receipt images, exact addresses, order numbers or payment details.
- Compare the delivery item subtotal with a matching, dated pickup price to estimate markup. Keep discounts and membership effects identifiable. Calibrate fee ranges from comparable submissions, and check on held-out orders how often the actual tip-excluded total lands in the range. Label the figures as estimates and keep the delivery view optional throughout the pilot.

## Import a Restaurants CSV

Export the Restaurants sheet as CSV, then run `npm run import:restaurants -- /path/to/Restaurants.csv`. The export replaces the seed's set of rows. Use `--output /path/to/review.json` to preview the result before replacing the seed. Invalid numbers, duplicate IDs, and malformed schedules stop the import before it writes the destination.

Use hours such as `Daily 11am–9pm` or `Mon-Fri 11:00-21:00; Sat-Sun closed`. Separate mood tags with commas, semicolons, or pipes. Use YYYY-MM-DD in `Price date checked`. If blank, use a status such as `Verified 2026-11-22` or pass `--snapshot-date YYYY-MM-DD` when that date applies to the entire export. Unchanged meals and prices can retain their prior dates.

The CSV can supply coordinates. Menu URLs and deal details come from the seed. Matching IDs retain location and menu details from the existing seed. A changed address clears location-specific metadata. Check coordinates for new or moved spots before they can appear in results. A blank hours cell can keep the prior schedule, and a blank cheapest meal price or description always makes the row unverified.

## Configure price reports

Set `NEXT_PUBLIC_REPORT_URL` to the Google Form's full `viewform` URL before building. Until configured, the link uses a placeholder. To prefill the form's restaurant question, also set `NEXT_PUBLIC_REPORT_RESTAURANT_FIELD` to its `entry.<id>` key from a Google Forms prefilled link. Without that setting, the app appends a generic `restaurant` query parameter. Rebuild the static export after changing either setting.

### Spreadsheet column names

Required headers are `ID`, `Name`, `Area`, `Address`, `Cuisine`, `Mood tags`, `Typical meal`, `Serves (people)`, `Typical meal pre-tax`, `Row status`, `Hours`, `Dietary notes`, `Cheapest complete meal`, `Cheapest meal pre-tax`, `Price source`, `Price date checked`, and `Price confidence`. The importer also accepts `Cheapest meal, pre-tax` as an alias. Optional headers are `Latitude` and `Longitude`. Fill them together with decimal degrees, or leave both blank to use coordinates already in the seed for that location. The importer ignores other columns, including `Geocode status`.

### One-off geocoding

Use the public endpoint only for a small, one-time batch on one machine. Run one copy of the script, reuse its cache and submit only public business addresses. See the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). Geocoding data is © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

Run `npm run geocode:restaurants -- Restaurants.csv`. The script sends sequential lookups at most once per second and caches responses in `.nominatim-cache.jsonl`. It writes `Restaurants.geocoded.csv` alongside the export. Use `--output PATH` or `--cache PATH` to choose different files.

Include the street number, street name, and city in each address. Review the `Geocode status` column before importing. Existing coordinates are preserved, and incomplete pairs, missing or ambiguous matches, and matches outside the City of Waterloo or with an unconfirmed municipality are flagged for manual review.

### Import a Meals CSV

Run `npm run import:meals -- /path/to/meals.csv` from the repository root. Add `--report /path/to/report.csv` for a row-by-row list of imported and skipped meals. This writes `data/meals.seed.json` separately from the Restaurants seed. Only verified meal rows with a verified parent restaurant and valid price are imported. Serve counts default to one when blank. The helper column and empty rows are ignored.

Best fit uses an affordable Typical or Big meal when available and otherwise chooses the Value option closest to budget. Cheapest first chooses the lowest tax-inclusive per-person total. Breakfast meals are eligible from 06:00 up to 11:00 Waterloo time. Restaurants with imported meal options use those options for all searches.
