import unittest

import audit


def point(t, *members, status="normal"):
    return {"t": t, "status": status, "stations": list(members)}


def member(station, source="hf_asos", temp=50.0, code="ok", received=0):
    return {"station_id": station, "source": source, "temp_f": temp, "code": code, "received_at_ms": received}


MIN = 60_000
DAY0 = audit.ms("2026-11-15")


class FeedTest(unittest.TestCase):
    def test_kinds(self):
        self.assertEqual(audit.feed(member("A")), "one_minute")
        self.assertEqual(audit.feed(member("A", source="metar")), "metar")
        self.assertEqual(audit.feed(member("A", temp=None)), "missing")
        self.assertEqual(audit.feed(member("A", code="pending")), "missing")


class StationHealthTest(unittest.TestCase):
    def test_counts_per_day_and_alert_after_a_run(self):
        pts = [point(DAY0 + i * MIN, member("A"), member("B", source="metar" if i < 30 else "hf_asos")) for i in range(40)]
        days, alerts = audit.station_health(pts)
        self.assertEqual(days["2026-11-15"]["A"], {"one_minute": 40, "metar": 0, "missing": 0})
        self.assertEqual(days["2026-11-15"]["B"], {"one_minute": 10, "metar": 30, "missing": 0})
        self.assertEqual(alerts, {"B": "2026-11-15T00:29Z"})

    def test_a_one_minute_reading_resets_the_run(self):
        pts = [point(DAY0 + i * MIN, member("B", source="hf_asos" if i == 20 else "metar")) for i in range(45)]
        _, alerts = audit.station_health(pts)
        self.assertEqual(alerts, {})


class SettlementRowsTest(unittest.TestCase):
    def test_fallback_age_and_last_one_minute_reading(self):
        t = DAY0 + 60 * MIN
        pts = [point(t - 3 * MIN, member("B", temp=48.2)), point(t - 2 * MIN, member("B", source="metar", temp=44.0)),
               point(t, member("A"), member("B", source="metar", temp=44.96, received=t - 61 * MIN), status="degraded")]
        markets = [{"event_ticker": "EV", "close_time": "2026-11-15T01:00:00Z", "expiration_value": "46.00",
                    "floor_strike": k} for k in (44.99, 45.99, 46.99)]
        original = audit.get
        audit.get = lambda path: {"markets": markets, "cursor": ""}
        try:
            rows = audit.settlement_rows("SER", pts, DAY0, DAY0 + audit.DAY_MS)
        finally:
            audit.get = original
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["fallbacks"], [{"station": "B", "metar_f": 44.96, "age_min": 61.0, "last_one_minute_f": 48.2}])
        self.assertEqual(rows[0]["nearest_strike"], 45.99)


if __name__ == "__main__":
    unittest.main()
