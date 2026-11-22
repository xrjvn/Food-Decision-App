# Food Decision App

A mobile-first meal picker for the University of Waterloo and Wilfrid Laurier University area.

## Run locally

Use Node.js 20.9 or newer. Run `npm ci` and `npm run dev`, then open the local URL printed by Next.js. Run `npm run build` to create the static preview in `out/`.

## Campus preview

The eight seed meals in `app/catalogue.ts` have approximate locations and estimated pre-tax prices in Canadian cents. Confirm current prices and hours with each restaurant. The browser calculates tax-inclusive totals and ranks the catalogue by mood, proximity, and the listed combo. Approximate walk times use straight-line distance.

Weekly hours are kept with their sources in the catalogue. The app interprets them in Waterloo time. Holiday exceptions and last-minute closures may differ from the posted schedule.

The ranking starts within 1 km and expands to 2 km after three re-rolls or when no eligible nearby picks remain. Over-budget picks require a separate opt-in. Deals are hidden more than 30 days after verification or when their validity period ends.

Run `npm test` for the ranking unit tests. The static export needs no database or Places API credentials.
