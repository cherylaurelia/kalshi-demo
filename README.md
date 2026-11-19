# Kalshi Weather Index: station feed health behind hourly settlements

Unofficial demo by Cheryl Aurelia, not affiliated with Kalshi. Built only from Kalshi's public Trade API (no key).

Live page: https://kalshi-index-feed.vercel.app

## What it found (Nov 1–18, 2026)

- **NYC (KXTEMPNYCHS):** station KISP1M had its own 1-minute reading on 100% of minutes Nov 6–14, then on 10–60% each day
  from Nov 15. 11 hourly settlements since Nov 15 used a METAR for KISP that was received about 61 minutes before the
  settlement minute. A station-health alert after 30 missed 1-minute readings in a row would have fired Nov 15, 9:54 AM ET.
- **Chicago Metro (KXTEMPCHIHS):** KDPA1M runs on METAR for roughly a fifth of its minutes on most days (long-running).
  3 settlements used a KDPA METAR received ~64 minutes earlier.
- **What it isn't:** the expiration values match the published index, and every fallback is inside the 75-minute
  maximum age in the contract terms ([CHIMETROWINDEX](https://assets.kalshi.com/contract_terms/CHIMETROWINDEX.pdf),
  [NYCWINDEX](https://assets.kalshi.com/contract_terms/NYCWINDEX.pdf)). The index followed its methodology; this is about one
  member's feed.

## How it works

`scripts/audit.py` (standard-library Python) reads:
- `GET /live_data/weather/{city}?detailed=true&from=&to=`: each minute's member readings with `source`
  (`hf_asos` = 1-minute ASOS, `metar` = fallback), `code` and `received_at_ms`;
- `GET /live_data/weather/{city}?from=&to=`: the published index values;
- `GET /markets?series_ticker=KXTEMPNYCHS|KXTEMPCHIHS&status=settled`: settled hourly markets and their expiration values.

It writes `public/audit.json`; the Next.js page in `app/` renders it at build time.

## Run it

```sh
python3 scripts/audit.py 2026-11-01 2026-11-19 > public/audit.json   # ~5 min
python3 -m unittest discover scripts
npm install && npm run build && npm run start
```
