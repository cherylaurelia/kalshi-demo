"""Audit Kalshi Weather Index settlements against station feed health.

Uses only Kalshi's public Trade API (no key) and the Python standard library:
  python3 scripts/audit.py 2026-11-01 2026-11-19 > public/audit.json

For each city (NYC, Chicago Metro) and each day it counts, per member station, the minutes
fed by the station's 1-minute ASOS reading, by a METAR fallback, or missing. For every settled
hourly market event (KXTEMPNYCHS, KXTEMPCHIHS) it checks the settlement minute: which members
were on fallback, how old the fallback reading was (minute minus received_at, a lower bound on
the observation's age), and the station's last 1-minute reading in the 10 minutes before.
"""
import datetime as dt
import json
import sys
import time
import urllib.request

API = "https://api.elections.kalshi.com/trade-api/v2"
CITIES = {"nyc": "KXTEMPNYCHS", "chicago": "KXTEMPCHIHS"}
DAY_MS = 86_400_000
OLD_MIN = 45   # a fallback at least this old counts as "hour-old" (the rule allows up to 75)
ALERT_MIN = 30 # consecutive missing 1-minute readings that would trigger a station-health alert


def get(path):
    for attempt in range(5):
        try:
            req = urllib.request.Request(API + path, headers={"User-Agent": "weather-index-audit"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2 * (attempt + 1))


def ms(day):
    return int(dt.datetime.fromisoformat(day).replace(tzinfo=dt.timezone.utc).timestamp() * 1000)


def iso(t):
    return dt.datetime.fromtimestamp(t / 1000, dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def minutes(city, start, end):
    """Detailed index points in [start, end), fetched a day at a time."""
    out = []
    for t in range(start, end, DAY_MS):
        out += get(f"/live_data/weather/{city}?detailed=true&from={t}&to={min(t + DAY_MS, end) - 1}")["timeseries"]
    return out


def feed(member):
    if member.get("temp_f") is None or member.get("code") != "ok":
        return "missing"
    return "one_minute" if member.get("source") == "hf_asos" else "metar"


def station_health(points):
    days, runs, alerts = {}, {}, {}
    for p in sorted(points, key=lambda p: p["t"]):
        day = iso(p["t"])[:10]
        for m in p["stations"]:
            s, kind = m["station_id"], feed(m)
            days.setdefault(day, {}).setdefault(s, {"one_minute": 0, "metar": 0, "missing": 0})[kind] += 1
            runs[s] = 0 if kind == "one_minute" else runs.get(s, 0) + 1
            if runs[s] == ALERT_MIN and s not in alerts:
                alerts[s] = iso(p["t"])
    return days, alerts


def settled_events(series, start, end):
    markets, cursor = [], ""
    while True:
        r = get(f"/markets?series_ticker={series}&status=settled&limit=1000" + (f"&cursor={cursor}" if cursor else ""))
        markets += r["markets"]
        cursor = r.get("cursor")
        if not cursor or not r["markets"]:
            break
    events = {}
    for m in markets:
        close = ms(m["close_time"].replace("Z", ""))
        if start <= close < end:
            events.setdefault(m["event_ticker"], {"close": close, "markets": []})["markets"].append(m)
    return events


def published(city, start, end):
    """Published index values {minute: value} (the plain series carries `v`; the detailed one doesn't)."""
    out = {}
    for t in range(start, end, DAY_MS):
        for p in get(f"/live_data/weather/{city}?from={t}&to={min(t + DAY_MS, end) - 1}")["timeseries"]:
            out[p["t"]] = p.get("v")
    return out


def settlement_rows(series, points, start, end, values=None):
    by_t = {p["t"]: p for p in points}
    values = values or {}
    rows = []
    for ticker, ev in sorted(settled_events(series, start, end).items()):
        t, p = ev["close"], by_t.get(ev["close"])
        if p is None:
            continue
        expiration = float(ev["markets"][0]["expiration_value"])
        fallbacks = []
        for m in p["stations"]:
            if feed(m) != "metar":
                continue
            last = None
            for q in range(t - 10 * 60_000, t, 60_000):
                prev = next((x for x in by_t.get(q, {}).get("stations", []) if x["station_id"] == m["station_id"]), None)
                if prev and feed(prev) == "one_minute":
                    last = prev["temp_f"]
            fallbacks.append({"station": m["station_id"], "metar_f": round(m["temp_f"], 2),
                              "age_min": round((t - m["received_at_ms"]) / 60_000, 1),
                              "last_one_minute_f": last})
        strikes = sorted({float(m["floor_strike"]) for m in ev["markets"] if m.get("floor_strike") is not None})
        rows.append({"event": ticker, "minute": iso(t), "settled_f": expiration, "status": p["status"],
                     "published_f": values.get(t),
                     "fallbacks": fallbacks, "nearest_strike": min(strikes, key=lambda k: abs(k - expiration)) if strikes else None})
    return rows


def main(first_day, end_day):
    start, end = ms(first_day), ms(end_day)
    report = {"generated_at": iso(int(time.time() * 1000)), "window": [first_day, end_day],
              "old_fallback_min": OLD_MIN, "alert_after_min": ALERT_MIN, "cities": {}}
    for city, series in CITIES.items():
        points = minutes(city, start, end)
        days, alerts = station_health(points)
        rows = settlement_rows(series, points, start, end, published(city, start, end))
        report["cities"][city] = {
            "series": series,
            "minutes": len(points),
            "station_days": days,
            "first_alert": alerts,
            "settlements": len(rows),
            "expiration_matches_published": sum(1 for r in rows if r["published_f"] is not None and abs(r["published_f"] - r["settled_f"]) < 0.005),
            "settlements_on_fallback": sum(1 for r in rows if r["fallbacks"]),
            "settlements_on_old_fallback": [r for r in rows if any(f["age_min"] >= OLD_MIN for f in r["fallbacks"])],
            "max_fallback_age_min": max((f["age_min"] for r in rows for f in r["fallbacks"]), default=None),
        }
        print(city, "minutes", len(points), "settlements", len(rows), file=sys.stderr)
    json.dump(report, sys.stdout, indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
