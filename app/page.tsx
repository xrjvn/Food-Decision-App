"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { cravings, diets, proteinPerDollar } from "./meals";
import { campuses, moods, spots, type Campus } from "./catalogue";

import { rankSpots, type RankedPick } from "./ranking";
import { nextWalkLimit, requestLocation, walkOptions } from "./location";
import { directionsUrl, reportPriceUrl } from "./outbound-links";
import { pilotLoggingEnabled, sendPilotEvents, type SpotEventType } from "./pilot-events";
import { budgetOptions, initialSearch, maxBudget, minBudget, updateSearch } from "./search-state";

type PickData = RankedPick<typeof spots[number]>;

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });


function Pick({ spot, primary, usingLocation, onTap }: {
  spot: PickData;
  primary?: boolean;
  usingLocation: boolean;
  onTap: (type: "menu_tap" | "directions_tap" | "report_tap") => void;
}) {
  const legacyDate = spot.usesTypicalMeal && spot.cheapestMealPriceCents !== undefined
    ? null
    : spot.cheapestMealPriceCents !== undefined || spot.deal?.priceCents === undefined
      ? spot.priceSnapshotDate : spot.deal.verifiedOn;
  const verifiedDate = spot.selectedMeal ? spot.selectedMeal.priceDate : legacyDate;
  const mealName = spot.selectedMeal?.meal ?? (spot.usesTypicalMeal ? spot.meal : spot.cheapestMeal || spot.meal);

  const { mainProtein, calories, proteinGrams } = spot.selectedMeal ?? {};
  const proteinValue = proteinPerDollar(spot.selectedMeal, spot.total);
  const nutrition = [
    mainProtein,
    calories === undefined ? undefined : `${calories} cal`,
    proteinGrams === undefined ? undefined : `${proteinGrams} g protein`,
    proteinValue === undefined ? undefined : `${proteinValue.toFixed(1)} g protein per $`,
  ].filter(Boolean).join(" · ");

  return (
    <article className={primary ? "pick featured" : "pick"}>
      <div className="pick-top">
        <div>
          {primary && <p className="eyebrow">TOP PICK</p>}
          {primary ? <h2>{spot.name}</h2> : <h3>{spot.name}</h3>}
          <p className="meal">{mealName}</p>
          {nutrition && <p className="location">{nutrition}</p>}
          {!spot.selectedMeal && !spot.usesTypicalMeal && spot.cheapestMeal && spot.meal && spot.meal !== spot.cheapestMeal && (
            <p className="location">Typical meal · {spot.meal}</p>
          )}
          <p className="location">Approx. {spot.walkMinutes} min walk{usingLocation ? " from your location" : ""} · {spot.area}</p>
        </div>
        <div className="price">
          <strong>{money.format(spot.total / 100)}</strong>
          {spot.usesPerPersonPrice && <small>per person · serves {spot.selectedMeal?.serves ?? spot.serves}</small>}
          <small>est. total with tax, tip not included</small>
          {spot.usesDeliveryAppPrice && <small>Delivery-app price, likely lower in store.</small>}
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
        <a href={directionsUrl(spot.name, spot.address || spot.area)} onClick={() => onTap("directions_tap")} target="_blank" rel="noreferrer">Directions</a>
        {spot.menu && <a href={spot.menu} onClick={() => onTap("menu_tap")} target="_blank" rel="noreferrer">Menu / order</a>}
      </div>
      <a className="price-report" href={reportPriceUrl(spot.name)} onClick={() => onTap("report_tap")} target="_blank" rel="noreferrer">
        Report a wrong price
      </a>
    </article>
  );
}

export default function Home() {
  const [search, dispatch] = useReducer(updateSearch, initialSearch);
  const { preferences, rejectedIds, recentTopPickIds, allowOverBudget } = search;
  const { campus, budget, mood, craving, diet, order, walkLimit } = preferences;
  const [now, setNow] = useState<Date>();
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const timer = window.setInterval(updateTime, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const requestId = useRef(0);
  const [distances, setDistances] = useState<ReadonlyMap<string, number>>();
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  function clearLocation() {
    requestId.current++;
    setLocating(false);
    setDistances(undefined);
    setLocationMessage("");
    dispatch({ type: "reset" });
  }

  function useMyLocation() {
    const id = ++requestId.current;
    setLocating(true);
    setLocationMessage("");
    const secure = window.isSecureContext && window.location.protocol === "https:";
    requestLocation(secure, secure ? navigator.geolocation : undefined, Object.values(campuses).map(({ point }) => point), spots, (result) => {
      if (requestId.current !== id) return;
      setLocating(false);
      dispatch({ type: "reset" });
      if (result.kind === "located") {
        setDistances(result.distances);
        return;
      }
      setDistances(undefined);
      const messages = {
        insecure: "Location requires HTTPS. Choose a campus instead.",
        unavailable: "Your location is unavailable. Choose a campus instead.",
        denied: "Location permission was denied. Choose a campus instead.",
        "too-far": "You’re more than about 8 km from both campuses. Choose a campus instead.",
      };
      setLocationMessage(messages[result.kind]);
    });
  }

  const budgetCents = Math.round(budget * 100);
  const result = now && rankSpots(spots, {
    origin: campuses[campus].point,
    walkLimit,
    distances,
    mood,
    mealFilters: { craving, diet },
    budgetCents,
    order,
    now,
    rejectedIds,
    recentTopPickIds,
    allowOverBudget,
  });
  const matches = result?.picks ?? [];
  const [top, ...alternates] = matches.slice(0, 4);
  const unknownHoursPicks = result?.unknownHoursPicks ?? [];
  const locationMode = distances ? "device" : "campus";
  const pilotContext = { budget, mood, craving, diet, rankingMode: order, locationMode, walkLimitMinutes: walkLimit } as const;
  const lastImpression = useRef("");
  const lastExpandedImpression = useRef("");
  const fallbackVisible = useRef(false);

  function spotEvent(type: SpotEventType, spot: PickData, rankPosition: number) {
    return { type, restaurantId: spot.id, mealId: spot.selectedMeal?.id, rankPosition };
  }

  function logTap(type: SpotEventType, spot: PickData, rankPosition: number) {
    void sendPilotEvents(pilotContext, [spotEvent(type, spot, rankPosition)]);
  }

  function setRanking(next: typeof order) {
    if (order !== next) void sendPilotEvents({ ...pilotContext, rankingMode: next }, [{ type: "ranking_toggle" }]);
    dispatch({ type: "preference", change: { order: next } });
  }

  useEffect(() => {
    if (!pilotLoggingEnabled || !result) return;
    const shown = [
      ...result.picks.slice(0, 4).map((spot, index) => spotEvent("result_shown", spot, index + 1)),
      ...(result.unknownHoursPicks ?? []).map((spot, index) => spotEvent("result_shown", spot, result.picks.length + index + 1)),
    ];
    const additional = showAll ? result.picks.slice(4).map((spot, index) => spotEvent("result_shown", spot, index + 5)) : [];
    const expandedSignature = JSON.stringify([pilotContext, additional]);
    const signature = JSON.stringify([pilotContext, shown]);
    const fallback = Boolean(result.unknownHoursPicks?.length);
    const events: Parameters<typeof sendPilotEvents>[1][number][] = [];
    if (signature !== lastImpression.current) events.push(...shown);
    if (expandedSignature !== lastExpandedImpression.current) events.push(...additional);
    lastExpandedImpression.current = expandedSignature;
    if (fallback && !fallbackVisible.current) events.push({ type: "hours_fallback_shown" });
    lastImpression.current = signature;
    fallbackVisible.current = fallback;
    if (events.length) void sendPilotEvents(pilotContext, events);
  }, [result, pilotContext, showAll]);

  const widerLimit = result && nextWalkLimit(walkLimit, result.picks.filter((pick) => pick.total <= budgetCents).length);
  const messages = {
    nearby: `Showing picks within a ${walkLimit}-minute walk.`,
    wider: "Showing open picks within your walking limit.",
    "ask-over-budget": `No other open picks fit your budget within a ${walkLimit}-minute walk.`,
    "over-budget": `Showing the lowest-priced open picks above your budget within a ${walkLimit}-minute walk.`,
    "nothing-open": `No spots are confirmed open within a ${walkLimit}-minute walk right now.`,
    exhausted: `You’ve skipped all the open picks within a ${walkLimit}-minute walk.`,
  };
  const empty = Boolean(result && !top && unknownHoursPicks.length === 0);
  const canBroadenDiet = empty && diet !== "Anything";
  const cravingLabel = craving === "Dessert/Drink" ? "dessert and drinks" : craving.toLowerCase();
  const matching = `${cravingLabel} options${canBroadenDiet ? ` with Diet set to ${diet}` : ""}`;
  const emptyReason = result?.kind === "ask-over-budget"
    ? `No open ${matching} fit your budget within a ${walkLimit}-minute walk.`
    : result?.kind === "exhausted"
      ? `You’ve skipped all the open ${matching} within a ${walkLimit}-minute walk.`
      : `No ${matching} are available within a ${walkLimit}-minute walk right now.`;
  const message = empty ? emptyReason : result ? messages[result.kind] : "Checking listed hours…";

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
          <div className="options origin-options">
            <select id="campus" value={campus} onChange={(event) => {
              clearLocation();
              dispatch({ type: "preference", change: { campus: event.target.value as Campus } });
            }}>
              {Object.entries(campuses).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
            </select>
            {distances || locating
              ? <button onClick={clearLocation}>{locating ? "Cancel" : "Clear location"}</button>
              : <button onClick={useMyLocation}>Use my location</button>}
          </div>
          <p role="status">{locating ? "Finding your location…" : distances ? "Using your location" : locationMessage}</p>
          <fieldset>
            <legend>Maximum walk</legend>
            <div className="options">
              {walkOptions.map((limit) => <button key={limit} aria-pressed={walkLimit === limit}
                onClick={() => dispatch({ type: "preference", change: { walkLimit: limit } })}>{limit} min</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Meal budget</legend>
            <div className="options">
              {budgetOptions.map((amount) => <button key={amount} aria-pressed={amount === budget} onClick={() => dispatch({ type: "preference", change: { budget: amount } })}>${amount}</button>)}
            </div>
            <form className="options custom-budget" onSubmit={(event) => {
              event.preventDefault();
              const amount = Number(new FormData(event.currentTarget).get("customBudget"));
              dispatch({ type: "preference", change: { budget: amount } });
            }}>
              <label htmlFor="custom-budget">Custom budget ($)</label>
              <input key={budget} id="custom-budget" name="customBudget" type="number" inputMode="decimal"
                min={minBudget} max={maxBudget} step="0.01" defaultValue={budget} required />
              <button type="submit">Apply</button>
            </form>
          </fieldset>
          <fieldset>
            <legend>Rank results by</legend>
            <div className="options">
              <button aria-pressed={order === "best-fit"} onClick={() => setRanking("best-fit")}>Best fit for my budget</button>
              <button aria-pressed={order === "cheapest"} onClick={() => setRanking("cheapest")}>Cheapest first</button>
              <button aria-pressed={order === "most-protein"} onClick={() => setRanking("most-protein")}>Most protein</button>
              <button aria-pressed={order === "protein-per-dollar"} onClick={() => setRanking("protein-per-dollar")}>Most protein per dollar</button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Craving</legend>
            <div className="options">
              {cravings.map((item) => <button key={item} aria-pressed={item === craving}
                onClick={() => dispatch({ type: "preference", change: { craving: item } })}>
                {item === "Dessert/Drink" ? "Dessert and drinks" : item}
              </button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Diet</legend>
            <div className="options">
              {diets.map((item) => <button key={item} aria-pressed={item === diet}
                onClick={() => dispatch({ type: "preference", change: { diet: item } })}>{item}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Preference</legend>
            <div className="options">
              {moods.map((item) => <button key={item} aria-pressed={item === mood} onClick={() => dispatch({ type: "preference", change: { mood: item } })}>{item === "Anything" ? "No preference" : item}</button>)}
            </div>
          </fieldset>
        </section>
        <section aria-label="Meal picks">
          <p className="sr-only" role="status">
            {top ? `Top pick: ${top.name}. ${alternates.length} alternatives shown. ${message}` : message}
          </p>
          {top ? <>
            {message && <p className="result-note">{message}</p>}
            <Pick spot={top} primary usingLocation={Boolean(distances)} onTap={(type) => logTap(type, top, 1)} />
            <button className="result-action" onClick={() => {
              logTap("reroll", top, 1);
              dispatch({ type: "reject", id: top.id, preferences });
            }}>
              Not feeling it
            </button>
          </> : <div className="pick">
            <p>{message}</p>
            {canBroadenDiet && <button className="result-action" onClick={() => dispatch({ type: "preference", change: { diet: "Anything" } })}>
              Switch Diet to Anything
            </button>}
            {result?.kind === "ask-over-budget" && <button className="result-action" onClick={() => dispatch({ type: "allow-over-budget", preferences })}>
              Show over-budget picks
            </button>}
            {rejectedIds.size > 0 && <button className="result-action" onClick={() => dispatch({ type: "reset" })}>Start over</button>}
          </div>}
          {alternates.length > 0 && <>
            <h2 className="alternate-title">Other nearby picks</h2>
            <div className="alternates">{alternates.map((spot, i) => <Pick key={spot.id} spot={spot} usingLocation={Boolean(distances)} onTap={(type) => logTap(type, spot, i + 2)} />)}</div>
          </>}
          {matches.length > 0 && (
            <details className="footnote" onToggle={(event) => setShowAll(event.currentTarget.open)}>
              <summary>See all matches ({matches.length})</summary>
              <ol>
                {matches.map((spot) => (
                  <li key={spot.id}>
                    <strong>{spot.name}</strong> · {spot.selectedMeal?.meal ?? (spot.usesTypicalMeal ? spot.meal : spot.cheapestMeal || spot.meal)}
                    {" · "}{money.format(spot.total / 100)}{spot.usesPerPersonPrice ? " per person" : ""}
                    {" · "}approx. {spot.walkMinutes} min walk
                    {spot.usesDeliveryAppPrice && " · Delivery-app price, likely lower in store."}
                  </li>
                ))}
              </ol>
            </details>
          )}
          {widerLimit && (
            <button className="result-action" onClick={() => dispatch({ type: "preference", change: { walkLimit: widerLimit } })}>
              Too few matches? Widen to {widerLimit} min
            </button>
          )}
          {unknownHoursPicks.length > 0 && (
            <section aria-labelledby="unknown-hours-heading">
              <h2 className="alternate-title" id="unknown-hours-heading">Hours not confirmed, check before you go</h2>
              <div className="alternates">{unknownHoursPicks.map((spot, i) => <Pick key={spot.id} spot={spot} usingLocation={Boolean(distances)} onTap={(type) => logTap(type, spot, matches.length + i + 1)} />)}</div>
            </section>
          )}
          <details className="footnote">
            <summary>How prices work</summary>
            <p>Prices are estimates per person. They include 13% Ontario HST and exclude tip. Each result shows the date its price was checked when available. We mark delivery-app prices because they can be higher than in-store prices.</p>
          </details>
          {(top || unknownHoursPicks.length > 0) && <p className="footnote">Check with the restaurant for current prices and holiday hours. Approximate walk times use straight-line distances adjusted for detours. Location data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>.</p>}
          {pilotLoggingEnabled && <p className="footnote">Anonymous usage stats. Your location is never stored.</p>}
        </section>
      </div>
    </main>
  );
}
