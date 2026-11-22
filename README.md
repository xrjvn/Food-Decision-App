# Food Decision App

A mobile-first meal picker for the University of Waterloo and Wilfrid Laurier University area.

## Run locally

Use Node.js 20.9 or newer. Run `npm ci` and `npm run dev`, then open the local URL printed by Next.js. Run `npm run build` to create the static preview in `out/`.

## Step 1 preview

The eight seed meals in `app/catalogue.ts` have approximate locations and estimated pre-tax prices in Canadian cents. Confirm current prices and hours with each restaurant. The browser calculates tax-inclusive totals and ranks the catalogue by mood, proximity, and the listed combo. Approximate walk times use straight-line distance.

Hours filtering, radius limits, re-roll and fallback rules, and ranking tests belong to step 2. The preview uses a static export and needs no database or Places API credentials.
