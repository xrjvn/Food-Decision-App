"use client";

import { useEffect, useReducer, useState } from "react";
import { campuses, moods, spots, type Campus } from "./catalogue";

import { rankSpots, type RankedPick } from "./ranking";
import { initialSearch, updateSearch } from "./search-state";

type PickData = RankedPick<typeof spots[number]>;

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const presets = [10, 15, 20];


function reportPriceUrl(restaurant: string) {
  const placeholder = "https://docs.google.com/forms/d/e/REPLACE_WITH_FORM_ID/viewform";
  const configured = process.env.NEXT_PUBLIC_REPORT_URL || placeholder;
  let url: URL;
  try {
    url = new URL(configured);
    if (url.protocol !== "https:") url = new URL(placeholder);
  } catch {
    url = new URL(placeholder);
  }
  const field = process.env.NEXT_PUBLIC_REPORT_RESTAURANT_FIELD;
  url.searchParams.set(field || "restaurant", restaurant);
  if (field) url.searchParams.set("usp", "pp_url");
  return url.toString();
}

function Pick({ spot, primary }: { spot: PickData; primary?: boolean }) {
  const directions = new URLSearchParams({
    api: "1",
    destination: [spot.name, spot.address || spot.area, "Waterloo Ontario"].join(", "),
    travelmode: "walking",
  });
  const legacyDate = spot.usesTypicalMeal && spot.cheapestMealPriceCents !== undefined
    ? null
    : spot.cheapestMealPriceCents !== undefined || spot.deal?.priceCents === undefined
      ? spot.priceSnapshotDate : spot.deal.verifiedOn;
  const verifiedDate = spot.selectedMeal ? spot.selectedMeal.priceDate : legacyDate;
  const deliveryAppPrice = spot.deliveryAppPrice || spot.selectedMeal?.deliveryAppPrice;
  const mealName = spot.selectedMeal?.meal ?? (spot.usesTypicalMeal ? spot.meal : spot.cheapestMeal || spot.meal);

  return (
    <article className={primary ? "pick featured" : "pick"}>
      <div className="pick-top">
        <div>
          {primary && <p className="eyebrow">TOP PICK</p>}
          {primary ? <h2>{spot.name}</h2> : <h3>{spot.name}</h3>}
          <p className="meal">{mealName}</p>
          {!spot.selectedMeal && !spot.usesTypicalMeal && spot.cheapestMeal && spot.meal && spot.meal !== spot.cheapestMeal && (
            <p className="location">Typical meal · {spot.meal}</p>
          )}
          <p className="location">~{spot.walkMinutes} min walk · {spot.area}</p>
        </div>
        <div className="price">
          <strong>{money.format(spot.total / 100)}</strong>
          {spot.usesPerPersonPrice && <small>per person · serves {spot.selectedMeal?.serves ?? spot.serves}</small>}
          <small>est. total with tax, tip not included</small>
          {deliveryAppPrice && <small>Delivery-app price, likely lower in store.</small>}
          <small>{verifiedDate
            ? <>Price checked <time dateTime={verifiedDate}>{verifiedDate}</time></>
            : "Price check date unavailable"}
          </small>
        </div>
      </div>
      {spot.deal && <p className="deal">
        {spot.deal.description} · <a href={spot.deal.source} target="_blank" rel="noreferrer">verified on {spot.deal.verifiedOn}</a>
      </p>}
      <div className="links">
        <a href={`https://www.google.com/maps/dir/?${directions}`} target="_blank" rel="noreferrer">Directions</a>
        {spot.menu && <a href={spot.menu} target="_blank" rel="noreferrer">Menu / order</a>}
      </div>
      <a className="price-report" href={reportPriceUrl(spot.name)} target="_blank" rel="noreferrer">
        Report a wrong price
      </a>
    </article>
  );
}

export default function Home() {
  const [search, dispatch] = useReducer(updateSearch, initialSearch);
  const { preferences, rejectedIds, recentTopPickIds, allowOverBudget } = search;
  const { campus, budget, mood, order } = preferences;
  const [now, setNow] = useState<Date>();

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const timer = window.setInterval(updateTime, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const result = now && rankSpots(spots, {
    origin: campuses[campus].point,
    mood,
    budgetCents: budget * 100,
    order,
    now,
    rejectedIds,
    recentTopPickIds,
    allowOverBudget,
  });
  const [top, ...alternates] = result?.picks.slice(0, 4) ?? [];
  const unknownHoursPicks = result?.unknownHoursPicks ?? [];
  const messages = {
    nearby: "",
    wider: "Showing open picks within 2 km.",
    "ask-over-budget": "No other open picks fit your budget within 2 km.",
    "over-budget": "Showing the lowest-priced open picks above your budget within 2 km.",
    "nothing-open": "No spots are confirmed open within 2 km right now.",
    exhausted: "You’ve skipped all the open picks within 2 km.",
  };
  const message = result ? messages[result.kind] : "Checking listed hours…";

  return (
    <main>
      <header className="masthead"><span>Campus Bites</span><span>WATERLOO, ON</span></header>
      <div className="intro">
        <h1>What sounds good?</h1>
        <p>Find a nearby meal that fits your budget.</p>
      </div>
      <div className="columns">
        <section className="filters" aria-label="Meal preferences">
          <label htmlFor="campus">Starting point</label>
          <select id="campus" value={campus} onChange={(event) => dispatch({ type: "preference", change: { campus: event.target.value as Campus } })}>
            {Object.entries(campuses).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
          </select>
          <fieldset>
            <legend>Meal budget</legend>
            <div className="options">
              {presets.map((amount) => <button key={amount} aria-pressed={amount === budget} onClick={() => dispatch({ type: "preference", change: { budget: amount } })}>${amount}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Rank results by</legend>
            <div className="options">
              <button aria-pressed={order === "best-fit"} onClick={() => dispatch({ type: "preference", change: { order: "best-fit" } })}>Best fit for my budget</button>
              <button aria-pressed={order === "cheapest"} onClick={() => dispatch({ type: "preference", change: { order: "cheapest" } })}>Cheapest first</button>
            </div>
          </fieldset>
          <fieldset>
            <legend>In the mood for</legend>
            <div className="options">
              {moods.map((item) => <button key={item} aria-pressed={item === mood} onClick={() => dispatch({ type: "preference", change: { mood: item } })}>{item}</button>)}
            </div>
          </fieldset>
        </section>
        <section aria-label="Meal picks">
          <p className="sr-only" role="status">
            {top ? `Top pick: ${top.name}. ${alternates.length} alternatives shown. ${message}` : message}
          </p>
          {top ? <>
            {message && <p className="result-note">{message}</p>}
            <Pick spot={top} primary />
            <button className="result-action" onClick={() => dispatch({ type: "reject", id: top.id, preferences })}>
              Not feeling it
            </button>
          </> : <div className="pick">
            <p>{message}</p>
            {result?.kind === "ask-over-budget" && <button className="result-action" onClick={() => dispatch({ type: "allow-over-budget", preferences })}>
              Show over-budget picks
            </button>}
            {rejectedIds.size > 0 && <button className="result-action" onClick={() => dispatch({ type: "reset" })}>Start over</button>}
          </div>}
          {alternates.length > 0 && <>
            <h2 className="alternate-title">Other nearby picks</h2>
            <div className="alternates">{alternates.map((spot) => <Pick key={spot.id} spot={spot} />)}</div>
          </>}
          {unknownHoursPicks.length > 0 && (
            <section aria-labelledby="unknown-hours-heading">
              <h2 className="alternate-title" id="unknown-hours-heading">Hours not confirmed, check before you go</h2>
              <div className="alternates">{unknownHoursPicks.map((spot) => <Pick key={spot.id} spot={spot} />)}</div>
            </section>
          )}
          <details className="footnote">
            <summary>How prices work</summary>
            <p>Prices are estimates per person. They include 13% Ontario HST and exclude tip. Each result shows the date its price was checked when available. We mark delivery-app prices because they can be higher than in-store prices.</p>
          </details>
          {(top || unknownHoursPicks.length > 0) && <p className="footnote">Check with the restaurant for current prices and holiday hours. Walk times are based on straight-line distance. Location data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>.</p>}
        </section>
      </div>
    </main>
  );
}
