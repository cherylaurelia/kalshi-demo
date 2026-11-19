import report from "../public/audit.json";

export { report };

export const CITY_NAMES = { nyc: "New York City", chicago: "Chicago Metro" } as const;

export type CityKey = keyof typeof CITY_NAMES;

export const CITY_KEYS: CityKey[] = ["nyc", "chicago"];

export type Health = { one_minute: number; metar: number; missing: number };

/** Share of a station's minutes that day fed by its own 1-minute reading. */
export function oneMinuteShare(h: Health): number {
  const total = h.one_minute + h.metar + h.missing;

  return total === 0 ? 0 : h.one_minute / total;
}

export function stationsOf(city: CityKey): string[] {
  const names = new Set<string>();

  for (const day of Object.values(report.cities[city].station_days)) {
    for (const station of Object.keys(day)) names.add(station);
  }

  return [...names].toSorted();
}

export function daysOf(city: CityKey): string[] {
  return Object.keys(report.cities[city].station_days).toSorted();
}

export function healthOn(city: CityKey, day: string, station: string): Health | undefined {
  const days: Record<string, Record<string, Health>> = report.cities[city].station_days;

  return days[day]?.[station];
}

export function oldFallbackSettlements(city: CityKey) {
  return report.cities[city].settlements_on_old_fallback;
}

/** "2026-11-15T14:54Z" → "Nov 15, 9:54 AM ET" (UTC−5 in November). */
export function eastern(isoMinute: string): string {
  const t = new Date(isoMinute.replace("Z", ":00Z"));
  const et = new Date(t.getTime() - 5 * 3_600_000);
  const month = et.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const hours = et.getUTCHours();
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(et.getUTCMinutes()).padStart(2, "0");

  return `${month} ${et.getUTCDate()}, ${h12}:${minutes} ${hours < 12 ? "AM" : "PM"} ET`;
}

import upstream from "../public/upstream.json";

export { upstream };

export type ArchiveRow = (typeof upstream.settlements)[number];

export function archiveFor(event: string): ArchiveRow | undefined {
  return upstream.settlements.find((r) => r.event === event);
}

/** The settled value and the value with the archived 1-minute reading sit on different sides of the strike. */
export function crossesStrike(settled: number, other: number | null, strike: number | null): boolean {
  if (other === null || strike === null) return false;

  return settled > strike !== other > strike;
}
