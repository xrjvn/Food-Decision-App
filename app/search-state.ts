import type { Campus, Mood } from "./catalogue";
import type { RankingOrder } from "./ranking";

type Preferences = { campus: Campus; budget: number; mood: Mood; order: RankingOrder };

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

export const initialSearch = freshSearch({ campus: "uw", budget: 15, mood: "Anything", order: "best-fit" });

export function updateSearch(state: SearchState, action: Action): SearchState {
  switch (action.type) {
    case "preference": {
      const next = { ...state.preferences, ...action.change };
      const { campus, budget, mood, order } = state.preferences;
      return next.campus === campus && next.budget === budget && next.mood === mood && next.order === order
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
