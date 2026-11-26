export type Point = readonly [latitude: number, longitude: number];
export const walkOptions = [5, 10, 15, 20] as const;
export type WalkLimit = typeof walkOptions[number];
const walkingPaceMetresPerMinute = 80;
const detourFactor = 1.3;
export const metresPerMinute = walkingPaceMetresPerMinute / detourFactor;

export function walkingMinutes(distanceMetres: number) {
  return Math.max(1, Math.ceil(distanceMetres * detourFactor / walkingPaceMetresPerMinute));
}

const radians = Math.PI / 180;

export function distanceMetres(from: Point, to: Point) {
  const [lat, lon] = from;
  const [targetLat, targetLon] = to;
  const a = Math.sin((targetLat - lat) * radians / 2) ** 2
    + Math.cos(lat * radians) * Math.cos(targetLat * radians)
    * Math.sin((targetLon - lon) * radians / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, a)));
}

type LocationResult =
  | { kind: "located"; distances: ReadonlyMap<string, number> }
  | { kind: "insecure" | "unavailable" | "denied" | "too-far" };

type Destination = { id: string; point: Point };

export function requestLocation(
  secure: boolean,
  geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined,
  campusPoints: readonly Point[],
  destinations: readonly Destination[],
  complete: (result: LocationResult) => void,
) {
  if (!secure) {
    complete({ kind: "insecure" });
    return;
  }
  if (!geolocation) {
    complete({ kind: "unavailable" });
    return;
  }
  try {
    geolocation.getCurrentPosition(({ coords }) => {
      const point: Point = [coords.latitude, coords.longitude];
      if (!point.every(Number.isFinite) || Math.abs(point[0]) > 90 || Math.abs(point[1]) > 180) {
        complete({ kind: "unavailable" });
        return;
      }
      if (!campusPoints.some((campus) => distanceMetres(point, campus) <= 8000)) {
        complete({ kind: "too-far" });
        return;
      }
      // Only derived distances leave this callback. The app never retains the position.
      const distances = new Map(destinations.map(({ id, point: destination }) =>
        [id, distanceMetres(point, destination)] as const));
      complete({ kind: "located", distances });
    }, (error) => complete({ kind: error.code === 1 ? "denied" : "unavailable" }), {
      enableHighAccuracy: false,
      maximumAge: 0,
      timeout: 10_000,
    });
  } catch {
    complete({ kind: "unavailable" });
  }
}

export function nextWalkLimit(limit: WalkLimit, confirmedMatches: number) {
  return confirmedMatches < 3 ? walkOptions[walkOptions.indexOf(limit) + 1] : undefined;
}
