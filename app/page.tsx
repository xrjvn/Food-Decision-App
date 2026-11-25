"use client";

import { useEffect, useState } from "react";
import { campuses, moods, spots, type Campus, type Mood } from "./catalogue";

import { rankSpots, type RankedPick } from "./ranking";

type PickData = RankedPick<typeof spots[number]>;

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const presets = [10, 15, 20];
const RECENT_PICK_LIMIT = 3;

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
  const verifiedDate = spot.cheapestMealPriceCents !== undefined || spot.deal?.priceCents === undefined ? spot.priceSnapshotDate : spot.deal.verifiedOn;

  return (
    <article className={primary ? "pick featured" : "pick"}>
      <div className="pick-top">
        <div>
          {primary && <p className="eyebrow">TOP PICK</p>}
          {primary ? <h2>{spot.name}</h2> : <h3>{spot.name}</h3>}
          <p className="meal">{spot.cheapestMeal || spot.meal}</p>
          {spot.cheapestMeal && spot.meal && spot.meal !== spot.cheapestMeal && (
            <p className="location">Typical meal · {spot.meal}</p>
          )}
          <p className="location">~{spot.walkMinutes} min walk · {spot.area}</p>
        </div>
        <div className="price">
          <strong>{money.format(spot.total / 100)}</strong>
          <small>est. total with tax, tip not included</small>
          <small>{verifiedDate
            ? <>Price verified <time dateTime={verifiedDate}>{verifiedDate}</time></>
            : "Price verification date unavailable"}
          </small>
        </div>
      </div>
      {spot.deal && <p className="deal">
        {spot.deal.description} · <a href={spot.deal.source} target="_blank" rel="noreferrer">verified on {spot.deal.verifiedOn}</a>
      </p>}
      <div className="links">
        <a href={`https://www.google.com/maps/dir/?${directions}`} target="_blank" rel="noreferrer">Directions</a>
        {spot.menu && <a href={spot.menu} target="_blank" rel="noreferrer">Menu</a>}
      </div>
      <a className="price-report" href={reportPriceUrl(spot.name)} target="_blank" rel="noreferrer">
        Report a wrong price
      </a>
    </article>
  );
}

export default function Home() {
  const [campus, setCampus] = useState<Campus>("uw");
  const [budget, setBudget] = useState(15);
  const [mood, setMood] = useState<Mood>("Anything");
  const [now, setNow] = useState<Date>();
  const [rejectedIds, setRejectedIds] = useState<ReadonlySet<string>>(new Set());
  const [recentTopPickIds, setRecentTopPickIds] = useState<string[]>([]);
  const [allowOverBudget, setAllowOverBudget] = useState(false);

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const timer = window.setInterval(updateTime, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  function resetPicks() {
    setRejectedIds(new Set());
    setAllowOverBudget(false);
  }

  function rememberTopPick(id: string) {
    setRecentTopPickIds((ids) => [id, ...ids.filter((recentId) => recentId !== id)].slice(0, RECENT_PICK_LIMIT));
  }

  function changePreference() {
    if (top) rememberTopPick(top.id);
    resetPicks();
  }

  const result = now && rankSpots(spots, {
    origin: campuses[campus].point,
    mood,
    budgetCents: budget * 100,
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
          <select id="campus" value={campus} onChange={(event) => { setCampus(event.target.value as Campus); changePreference(); }}>
            {Object.entries(campuses).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
          </select>
          <fieldset>
            <legend>Meal budget</legend>
            <div className="options">
              {presets.map((amount) => <button key={amount} aria-pressed={amount === budget} onClick={() => { if (amount !== budget) { setBudget(amount); changePreference(); } }}>${amount}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>In the mood for</legend>
            <div className="options">
              {moods.map((item) => <button key={item} aria-pressed={item === mood} onClick={() => { if (item !== mood) { setMood(item); changePreference(); } }}>{item}</button>)}
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
            <button className="result-action" onClick={() => {
              rememberTopPick(top.id);
              setRejectedIds((ids) => new Set([...ids, top.id]));
            }}>
              Not feeling it
            </button>
          </> : <div className="pick">
            <p>{message}</p>
            {result?.kind === "ask-over-budget" && <button className="result-action" onClick={() => setAllowOverBudget(true)}>
              Show over-budget picks
            </button>}
            {rejectedIds.size > 0 && <button className="result-action" onClick={resetPicks}>Start over</button>}
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
          {(top || unknownHoursPicks.length > 0) && <p className="footnote">Check with the restaurant for current prices and holiday hours. Walk times are based on straight-line distance. Location data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>.</p>}
        </section>
      </div>
    </main>
  );
}
