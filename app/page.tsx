"use client";

import { useState } from "react";
import { campuses, getPicks, moods, type Campus, type Mood } from "./catalogue";

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const presets = [10, 15, 20];

function Pick({ spot, primary }: { spot: ReturnType<typeof getPicks>[number]; primary?: boolean }) {
  const directions = new URLSearchParams({
    api: "1",
    destination: spot.name + " Waterloo Ontario " + spot.area,
    travelmode: "walking",
  });
  return (
    <article className={primary ? "pick featured" : "pick"}>
      <div className="pick-top">
        <div>
          {primary && <p className="eyebrow">TOP PICK</p>}
          {primary ? <h2>{spot.name}</h2> : <h3>{spot.name}</h3>}
          <p className="meal">{spot.meal}</p>
          <p className="location">~{spot.walkMinutes} min walk · {spot.area}</p>
        </div>
        <div className="price">
          <strong>{money.format(spot.total / 100)}</strong>
          <small>est. total with tax, tip not included</small>
        </div>
      </div>
      {spot.deal && <p className="deal">{spot.deal}</p>}
      <div className="links">
        <a href={`https://www.google.com/maps/dir/?${directions}`} target="_blank" rel="noreferrer">Directions</a>
        <a href={spot.menu} target="_blank" rel="noreferrer">Menu</a>
      </div>
    </article>
  );
}

export default function Home() {
  const [campus, setCampus] = useState<Campus>("uw");
  const [budget, setBudget] = useState(15);
  const [mood, setMood] = useState<Mood>("Anything");
  const picks = getPicks(campus, mood, budget);
  const [top, ...alternates] = picks.slice(0, 4);

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
          <select id="campus" value={campus} onChange={(event) => setCampus(event.target.value as Campus)}>
            {Object.entries(campuses).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
          </select>
          <fieldset>
            <legend>Meal budget</legend>
            <div className="options">
              {presets.map((amount) => <button key={amount} aria-pressed={amount === budget} onClick={() => setBudget(amount)}>${amount}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>In the mood for</legend>
            <div className="options">
              {moods.map((item) => <button key={item} aria-pressed={item === mood} onClick={() => setMood(item)}>{item}</button>)}
            </div>
          </fieldset>
        </section>
        <section aria-label="Meal picks">
          <p className="sr-only" role="status">{top ? `Top pick: ${top.name}. ${alternates.length} alternatives shown.` : "No picks within budget."}</p>
          {top ? <Pick spot={top} primary /> : <div className="pick"><h2>No picks within budget</h2><p>Try a higher budget to see more meals.</p></div>}
          {alternates.length > 0 && <>
            <h2 className="alternate-title">Other nearby picks</h2>
            <div className="alternates">{alternates.map((spot) => <Pick key={spot.name} spot={spot} />)}</div>
          </>}
          {top && <p className="footnote">Preview menu estimates. Check with the restaurant for current prices and hours. Walk times are based on straight-line distance.</p>}
        </section>
      </div>
    </main>
  );
}
