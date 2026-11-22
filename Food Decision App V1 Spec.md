# Food Decision App: V1 Spec

Draft for Arjun, November 22, 2026. Items marked **(assumed)** are guesses to confirm or correct.

## 1. Problem

- **Who/when:** A student near campus who wants food, has a budget in mind, and loses 20 minutes scrolling delivery apps without deciding.
- **Today:** They open Uber Eats or Skip, face hundreds of options, then hit service fees, delivery fees, and menu markups that only show up at checkout. Many give up and order the same thing again.
- **Why I care:** I live this. I'm a student in a university city who doesn't want to break the bank. That's a strong, honest interview opener.
- **One-line pitch:** "Tell it your budget and mood, and it tells you where to eat, with the cheapest real deal first."

## 2. User

- **Primary user (assumed):** A Laurier or UW undergrad living within a short walk or bus ride of campus, spending roughly $8 to $20 per meal, mostly eating out or picking up, with delivery as an occasional treat.
- **Scope:** The Laurier/UW strip only. No other city in v1.

## 3. Core flow

1. Open the link on a phone (a mobile-first web app, no sign-up).
2. Set a budget (a slider or presets like under $10, $15, $20) and optionally a mood or cuisine (quick, filling, healthy, treat).
3. The app uses your location (or a campus area picker if permission is denied).
4. It returns **one top pick** with price estimate, distance, whether it's open, and any active deal, plus 3 alternates and a "not feeling it" re-roll button.
5. Tap through to directions or the restaurant's menu and order page.

The result screen is the product. Spend most of the design time there.

## 4. V1 features

**In:**

- Budget + mood input
- One-pick result with alternates and re-roll
- Open-now and distance filtering
- Deals layer (manually curated)
- Basic usage logging (what was shown, what was tapped, whether they came back)

**Out for v1:**

- Delivery app integration or price comparison
- Scraping Uber Eats, Skip, or DoorDash
- User accounts, reviews, or social features
- Payments or ordering inside the app
- Any area beyond campus
- A native iOS/Android app

## 5. Data

- **Base data:** Google Places for names, locations, hours, and a coarse price level. Caveats: the price level is only a rough bucket, and Google's terms limit how long most place data can be stored. Plan to store the place ID and fetch details live, plus my own fields. Check current pricing and caching terms before building. OpenStreetMap is a free fallback for basic locations.
- **Own data layer (the valuable part):** Hand-curate 40 to 60 spots around campus with a typical meal price, cuisine and mood tags, and dine-in or pickup notes. This is slow, but it's what makes the picks actually good, since Google can't tell you a place is a $9 combo.
- **Deal record fields:** restaurant, description, discount or price, days and times valid, student-only (yes/no), source link, date last verified.
- **Staleness:** Show "verified on \[date\]" on every deal and hide anything unverified for more than 30 days. Re-check deals weekly during testing. How much work that is will show whether this can scale.
- **Sourcing deals:** restaurant sites, Instagram, and student-union or campus pages, with a link back to the source. Ask restaurants directly when possible. Use an LLM to pull deal details out of messy captions, but check the output by hand.

## 6. Ranking logic

- **Hard filters:** open now, estimated price within budget, within the distance limit.
- **Soft score:** a weighted sum, for example deal available (big boost), distance (closer is better), mood match, rating (small weight), and a novelty penalty so the same place doesn't win every time.
- **Edge cases:**
  - Nothing open (late night): show the closest open options and say so.
  - Nothing within budget: show the cheapest options and be upfront that they're over budget.
  - User rejects every pick: after 3 re-rolls, loosen one filter and tell them which.
- **Key tradeoff:** price estimates will sometimes be wrong. Label them as estimates, and be exact only where a deal gives a real price.

## 7. Success metrics

- **Product:** 20 to 30 testers over about 2 weeks. A good sign is 30% or more using it again after the first session. If almost nobody returns, the idea or the flow has a problem, not the code.
- **Business:** Talk to 5 or more restaurants. A good sign is 2 or more willing to run a student deal. Willingness to pay is a bonus, and an honest "no" there is still useful data.
- **Go / stop:** Keep going if people return and a few restaurants are interested. Otherwise, write up what I learned and move on. Either outcome is a usable interview story.

## 8. Tech and tooling

Suggestions, adjust freely.

- **Stack (assumed):** React or Next.js frontend, a small backend or serverless functions, and Postgres via something like Supabase for restaurants, deals, and logs. Host on a free tier.
- **Build tool:** an agentic coding tool in the project folder (ChatGPT Plus's coding agent if the plan includes it, which is worth checking), with chat for planning and review.
- **Notes file:** a short markdown file in the repo with the stack, conventions, and the scope and out-of-scope lists above.

## 9. Open questions

- **Timeline:** It's late November and I'm in my final year, with exams coming. Build the core in a few weeks, then test after finals. Ship something small rather than plan something big.
- **Platform terms:** How deals and place data are sourced and displayed needs to respect Google's and each restaurant's terms. When in doubt, link to the source and ask permission.
- **Name and branding:** undecided.
- **Who maintains the deals data if this grows?** This is the real business question, and the manual pilot is the test of it.
- **How do I get the first 20 testers?** Classmates, residence group chats, and campus clubs are the obvious starting points. Decide before building.
