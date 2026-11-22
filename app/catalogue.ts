export const campuses = {
  uw: { name: "University of Waterloo", point: [43.4711, -80.5423] },
  laurier: { name: "Wilfrid Laurier University", point: [43.4739, -80.5275] },
} as const;

export const moods = ["Anything", "Quick", "Filling", "Light", "Treat"] as const;
export type Campus = keyof typeof campuses;
export type Mood = typeof moods[number];

type Spot = {
  name: string;
  meal: string;
  priceCents: number;
  area: string;
  point: readonly [number, number];
  moods: readonly Mood[];
  menu: string;
  deal?: string;
};

export const spots: readonly Spot[] = [
  { name: "Campus Pizza", meal: "Two pizza slices", priceCents: 800, area: "University Plaza", point: [43.4719, -80.5378], moods: ["Quick", "Filling"], menu: "https://campuspizza-alpha.vercel.app/menu" },
  { name: "Shawerma Plus", meal: "Falafel wrap", priceCents: 1099, area: "University Ave W", point: [43.4722, -80.5374], moods: ["Quick", "Light"], menu: "https://custom.order.online/en-CA/store/ShawermaPlus-318677?hideModal=true&pickup=true" },
  { name: "Bao Sandwich Bar", meal: "Baguette sandwich combo", priceCents: 1699, area: "Balsam Street", point: [43.4765, -80.5271], moods: ["Filling", "Treat"], menu: "https://www.baosandwichbar.com/menu", deal: "Everyday combo with a side and drink" },
  { name: "Gol’s Lanzhou Noodle", meal: "Beef noodle soup", priceCents: 1649, area: "University Ave W", point: [43.4725, -80.5368], moods: ["Filling", "Treat"], menu: "https://lanzhou.ca/waterloo/" },
  { name: "Aunty’s Kitchen", meal: "Chicken shawarma on rice", priceCents: 1399, area: "University Ave W", point: [43.4722, -80.5374], moods: ["Filling"], menu: "https://order.online/en-CA/store/aunty%27s-kitchen-waterloo-278840" },
  { name: "Lazeez Shawarma", meal: "Chicken shawarma wrap", priceCents: 1199, area: "University Plaza", point: [43.4718, -80.5379], moods: ["Quick", "Filling"], menu: "https://menuweb.menu/restaurants/waterloo/lazeez-shawarma-9/menu" },
  { name: "Fresh Burrito", meal: "Bean burrito", priceCents: 1099, area: "King Street North", point: [43.4752, -80.5252], moods: ["Quick", "Light"], menu: "https://wnam-cdn.lacarte.menu/storage/media/companies_menu_pdf/114395794/presotea-kingston-menu.pdf" },
  { name: "iPotato", meal: "Falafel sandwich", priceCents: 1199, area: "University Plaza", point: [43.4718, -80.5377], moods: ["Quick", "Light"], menu: "https://ipotato.wheree.com/menu" },
];

const ONTARIO_HST = 0.13;
const radians = Math.PI / 180;

function distanceMetres(from: readonly [number, number], to: readonly [number, number]) {
  const [lat, lon] = from;
  const [targetLat, targetLon] = to;
  const a = Math.sin((targetLat - lat) * radians / 2) ** 2
    + Math.cos(lat * radians) * Math.cos(targetLat * radians)
    * Math.sin((targetLon - lon) * radians / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(a));
}

export function getPicks(campus: Campus, mood: Mood, budget: number) {
  return spots.map((spot) => {
    const total = spot.priceCents + Math.round(spot.priceCents * ONTARIO_HST);
    const distance = distanceMetres(campuses[campus].point, spot.point);
    const score = Number(spot.moods.includes(mood)) * 12 + Number(Boolean(spot.deal)) * 8 - distance / 100;
    return { ...spot, total, distance, score, walkMinutes: Math.max(1, Math.round(distance / 80)) };
  }).filter((spot) => spot.total <= budget * 100)
    .sort((a, b) => b.score - a.score || a.total - b.total);
}
