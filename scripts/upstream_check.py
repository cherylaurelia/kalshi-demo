"""Compare KISP1M's feed in the Kalshi index with the station's public 1-minute ASOS archive.

  python3 scripts/upstream_check.py public/audit.json > public/upstream.json

Source of the archive: Iowa Environmental Mesonet's ASOS 1-minute service (NOAA/NCEI 1-minute ASOS data).
For each day it counts minutes with a temperature in the archive. For each NYC settlement that used a
KISP METAR fallback received 45+ minutes earlier, it looks up KISP's archived 1-minute temperature at the
settlement minute and what the index would read with that member value in place of the METAR, using the
weights the index itself uses for that minute (the member's share of the members present).
"""
import csv
import io
import json
import sys
import urllib.request

from audit import get, ms

IEM = ("https://mesonet.agron.iastate.edu/cgi-bin/request/asos1min.py?station=ISP&vars=tmpf"
       "&sample=1min&what=download&tz=UTC&sts={start}T00:00Z&ets={end}T00:00Z")
STATION = "KISP1M"


def archive(start, end):
    with urllib.request.urlopen(IEM.format(start=start, end=end), timeout=120) as r:
        rows = csv.DictReader(io.StringIO(r.read().decode()))
        return {row["valid(UTC)"].replace(" ", "T") + "Z": float(row["tmpf"]) for row in rows if row["tmpf"] not in ("", "M")}


def member_share(city, minute_ms, station):
    cal = [c for c in get(f"/live_data/weather/{city}/calibrations")["calibrations"] if c["effective_at_ms"] <= minute_ms][-1]
    weights = {s["station_id"]: s["weight"] for s in cal["stations"]}
    point = get(f"/live_data/weather/{city}?detailed=true&from={minute_ms}&to={minute_ms}")["timeseries"][0]
    present = [m["station_id"] for m in point["stations"] if m.get("code") == "ok" and m.get("temp_f") is not None]
    return weights[station] / sum(weights[s] for s in present)


def main(audit_path):
    report = json.load(open(audit_path))
    first, end = report["window"]
    temps = archive(first, end)
    per_day = {}
    for minute in temps:
        per_day[minute[:10]] = per_day.get(minute[:10], 0) + 1
    rows = []
    for r in report["cities"]["nyc"]["settlements_on_old_fallback"]:
        for f in r["fallbacks"]:
            if f["station"] != STATION:
                continue
            actual = temps.get(r["minute"])
            share = member_share("nyc", ms(r["minute"].replace("Z", "")), STATION)
            with_actual = None if actual is None else round(r["settled_f"] + share * (actual - f["metar_f"]), 2)
            rows.append({"event": r["event"], "minute": r["minute"], "settled_f": r["settled_f"], "metar_f": f["metar_f"],
                         "archive_one_minute_f": actual, "index_with_archive_f": with_actual})
    json.dump({"station": STATION, "archive_minutes_per_day": per_day, "settlements": rows}, sys.stdout, indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
