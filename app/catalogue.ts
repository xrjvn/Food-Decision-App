import type { OpeningWindow, RankingSpot } from "./ranking";

export const campuses = {
  uw: { name: "University of Waterloo", point: [43.4711, -80.5423] },
  laurier: { name: "Wilfrid Laurier University", point: [43.4739, -80.5275] },
} as const;

export const moods = ["Anything", "Quick", "Filling", "Light", "Treat"] as const;
export type Campus = keyof typeof campuses;
export type Mood = typeof moods[number];

const everyDay = [0, 1, 2, 3, 4, 5, 6];

function hours(days: readonly number[], opens: number, closes: number): OpeningWindow {
  return { days, opens: opens * 60, closes: closes * 60 };
}

type Spot = RankingSpot & { area: string; menu: string; hoursSource: string };

export const spots: readonly Spot[] = [
  { id: "campus-pizza", name: "Campus Pizza", meal: "Two pizza slices", priceCents: 800, area: "University Plaza", point: [43.4719, -80.5378], moods: ["Quick", "Filling"], menu: "https://campuspizza-alpha.vercel.app/menu",
    hours: [hours(everyDay, 11, 4)], hoursSource: "https://campuspizza-alpha.vercel.app/contact" },
  { id: "shawerma-plus", name: "Shawerma Plus", meal: "Falafel wrap", priceCents: 1099, area: "University Ave W", point: [43.4722, -80.5374], moods: ["Quick", "Light"], menu: "https://custom.order.online/en-CA/store/ShawermaPlus-318677?hideModal=true&pickup=true",
    hours: [hours([0, 1, 2, 3, 4], 11, 0), hours([5, 6], 11, 1)], hoursSource: "https://www.restaurantji.com/on/waterloo/shawerma-plus-2/" },
  { id: "bao", name: "Bao Sandwich Bar", meal: "Baguette sandwich combo", priceCents: 1699, area: "Balsam Street", point: [43.4765, -80.5271], moods: ["Filling", "Treat"], menu: "https://www.baosandwichbar.com/menu", deal: { description: "Everyday combo with a side and drink", verifiedOn: "2026-11-22", source: "https://www.baosandwichbar.com/menu" },
    hours: [hours([0, 1, 2, 3], 11, 21), hours([4], 11, 21.5), hours([5, 6], 11, 22)], hoursSource: "https://www.baosandwichbar.com/menu" },
  { id: "gols", name: "Gol’s Lanzhou Noodle", meal: "Beef noodle soup", priceCents: 1649, area: "University Ave W", point: [43.4725, -80.5368], moods: ["Filling", "Treat"], menu: "https://lanzhou.ca/waterloo/",
    hours: [hours(everyDay, 11, 21)], hoursSource: "https://lanzhou.ca/waterloo/" },
  { id: "auntys", name: "Aunty’s Kitchen", meal: "Chicken shawarma on rice", priceCents: 1399, area: "University Ave W", point: [43.4722, -80.5374], moods: ["Filling"], menu: "https://order.online/en-CA/store/aunty%27s-kitchen-waterloo-278840",
    hours: [hours(everyDay, 11, 3)], hoursSource: "https://www.restaurantji.com/on/waterloo/auntys-kitchen-waterloo-/" },
  { id: "lazeez", name: "Lazeez Shawarma", meal: "Chicken shawarma wrap", priceCents: 1199, area: "University Plaza", point: [43.4718, -80.5379], moods: ["Quick", "Filling"], menu: "https://menuweb.menu/restaurants/waterloo/lazeez-shawarma-9/menu",
    hours: [hours(everyDay, 11, 0)], hoursSource: "https://www.restaurantji.com/on/waterloo/lazeez-shawarma-2/" },
  { id: "fresh-burrito", name: "Fresh Burrito", meal: "Bean burrito", priceCents: 1099, area: "King Street North", point: [43.4752, -80.5252], moods: ["Quick", "Light"], menu: "https://wnam-cdn.lacarte.menu/storage/media/companies_menu_pdf/114395794/presotea-kingston-menu.pdf",
    hours: [hours([1, 2, 3, 4, 5], 11, 5), hours([0, 6], 12, 5)], hoursSource: "https://www.restaurantji.com/on/waterloo/fresh-burrito-2/" },
  { id: "ipotato", name: "iPotato", meal: "Falafel sandwich", priceCents: 1199, area: "University Plaza", point: [43.4718, -80.5377], moods: ["Quick", "Light"], menu: "https://ipotato.wheree.com/menu",
    hours: [hours(everyDay, 11, 0)], hoursSource: "https://www.restaurantji.com/on/waterloo/ipotato-/" },
];
