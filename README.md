# Food Decision App

A mobile-first meal picker for the University of Waterloo and Wilfrid Laurier University area.

## Run locally

Use Node.js 20.9 or newer. Run `npm ci` and `npm run dev`, then open the local URL printed by Next.js. Run `npm run build` to create the static preview in `out/`.

## Campus preview

Edit `data/restaurants.seed.json` to maintain the catalogue. Store typical pre-tax meal prices in Canadian cents and use `serves` for the number of people the listed meal feeds. `price_snapshot_date` is the date the menu price was checked (YYYY-MM-DD), or null when unconfirmed. Keep `verified` false until the location, menu price and weekly hours have been checked against the linked sources. Only verified rows enter ranking. Menu prices can still change.

The browser calculates tax-inclusive totals and ranks by mood, proximity and active deals. A small penalty for the last three distinct top picks within the current page visit helps introduce variety. Approximate walk times use straight-line distance.

Weekly hours are kept with their sources in the catalogue. The app interprets them in Waterloo time. Holiday exceptions and last-minute closures may differ from the posted schedule.

The ranking starts within 1 km and expands to 2 km after three re-rolls or when no eligible nearby picks remain. Over-budget picks require a separate opt-in. Deals are hidden more than 30 days after verification or when their validity period ends.

Run `npm test` for the ranking unit tests. The static export needs no database or Places API credentials.

## Step 4 plan — delivery estimates

Start after the pickup flow, catalogue maintenance and pilot measurement are working.

- Keep pickup as the default. Add a Delivery toggle and label its results “Estimated delivery total · tip excluded.” Show a range in CAD with a breakdown of the pickup menu price, estimated item markup, delivery fee, service fee and applicable HST. Calculate tax on the applicable components and make the low and high scenarios explicit. Show when the estimate was updated and how many comparable orders informed it. If data is sparse, show that an estimate is unavailable. For budget labels, distinguish a range entirely under budget, one that crosses the budget and one entirely above it.
- Add a voluntary form for a real delivery order. Capture the restaurant, matched item and quantity, platform, approximate order date, coarse campus area, item subtotal, delivery fee, service fee, other fees, HST, discounts and paid total. Capture tip separately so the order can be compared with the tip-excluded estimate. Keep currency in CAD, validate that the amounts reconcile, and collect no receipt images, exact addresses, order numbers or payment details.
- Compare the delivery item subtotal with a matching, dated pickup price to estimate markup. Keep discounts and membership effects identifiable. Calibrate fee ranges from comparable submissions, and check on held-out orders how often the actual tip-excluded total lands in the range. Label the figures as estimates and keep the delivery view optional throughout the pilot.
