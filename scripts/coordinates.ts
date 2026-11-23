export const LATITUDE = "Latitude";
export const LONGITUDE = "Longitude";

export function parseCoordinate(value: string, max: number): number | null {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) && Math.abs(number) <= max ? number : null;
}
