import type { Campus, Mood } from "./catalogue";
import { defaultMealFilters, type MealFilters } from "./meals";
import type { WalkLimit } from "./location";
import type { RankingOrder } from "./ranking";

export const budgetOptions = [10, 15, 20] as const;
export const minBudget = 1;
export const maxBudget = 100;

export function isValidBudget(amount: number) {
  return Number.isFinite(amount) && amount >= minBudget && amount <= maxBudget
    && Math.round(amount * 100) / 100 === amount;
}

type Preferences = MealFilters & { campus: Campus; budget: number; mood: Mood; order: RankingOrder; walkLimit: WalkLimit };

type SearchState = {
  preferences: Preferences;
  rejectedIds: ReadonlySet<string>;
  recentTopPickIds: readonly string[];
  allowOverBudget: boolean;
};

type Action =
  | { type: "preference"; change: Partial<Preferences> }
  | { type: "reject"; id: string; preferences: Preferences }
  | { type: "allow-over-budget"; preferences: Preferences }
  | { type: "reset" };

function freshSearch(preferences: Preferences): SearchState {
  return { preferences, rejectedIds: new Set(), recentTopPickIds: [], allowOverBudget: false };
}

export const initialSearch = freshSearch({ ...defaultMealFilters, campus: "uw", budget: 15, mood: "Anything", order: "best-fit", walkLimit: 15 });

export function updateSearch(state: SearchState, action: Action): SearchState {
  switch (action.type) {
    case "preference": {
      const next = { ...state.preferences, ...action.change };
      if (!isValidBudget(next.budget)) return state;
      const { campus, budget, mood, craving, diet, order, walkLimit } = state.preferences;
      return next.campus === campus && next.budget === budget && next.mood === mood && next.craving === craving && next.diet === diet
        && next.order === order && next.walkLimit === walkLimit
        ? state : freshSearch(next);
    }
    case "reject":
      if (action.preferences !== state.preferences || state.rejectedIds.has(action.id)) return state;
      return {
        ...state,
        rejectedIds: new Set([...state.rejectedIds, action.id]),
        recentTopPickIds: [action.id, ...state.recentTopPickIds].slice(0, 3),
      };
    case "allow-over-budget":
      return action.preferences === state.preferences ? { ...state, allowOverBudget: true } : state;
    case "reset":
      return freshSearch({ ...state.preferences });
  }
}
