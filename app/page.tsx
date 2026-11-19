import {
  CITY_KEYS,
  CITY_NAMES,
  type CityKey,
  daysOf,
  eastern,
  healthOn,
  oldFallbackSettlements,
  oneMinuteShare,
  report,
  stationsOf,
} from "./audit";

const REPO = "https://github.com/cherylaurelia/kalshi-demo";
const NYC = report.cities.nyc;
const SINCE = "2026-11-15";
const nycRecent = NYC.settlements_on_old_fallback.filter((r) => r.minute >= SINCE);
const kispAlert = NYC.first_alert.KISP1M;
const maxAge = Math.max(NYC.max_fallback_age_min, report.cities.chicago.max_fallback_age_min);
const allSettlements = NYC.settlements + report.cities.chicago.settlements;
const matching = NYC.expiration_matches_published + report.cities.chicago.expiration_matches_published;

function cellTone(share: number): string {
  if (share >= 0.95) return "bg-up/15 text-up";

  if (share >= 0.6) return "bg-warn/15 text-warn";

  return "bg-down/20 text-down";
}

function HealthGrid({ city }: { city: CityKey }) {
  const days = daysOf(city);
  const stations = stationsOf(city);

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr className="text-faint">
            <th className="sticky left-0 bg-card px-3 py-2 text-left font-normal">station</th>
            {days.map((d) => (
              <th key={d} className="px-1 py-2 font-normal">
                {d.slice(8)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stations.map((s) => (
            <tr key={s} className="border-t border-line">
              <th className="sticky left-0 bg-card px-3 py-1.5 text-left font-normal text-ink">{s}</th>
              {days.map((d) => {
                const h = healthOn(city, d, s);

                if (!h) return <td key={d} className="px-1 text-center text-faint">·</td>;
                const share = oneMinuteShare(h);

                return (
                  <td key={d} className="px-0.5 py-1">
                    <span
                      title={`${s} ${d}: ${h.one_minute} one-minute, ${h.metar} METAR, ${h.missing} missing`}
                      className={`block rounded px-1 py-1 text-center ${cellTone(share)}`}
                    >
                      {Math.round(share * 100)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettlementTable({ city }: { city: CityKey }) {
  const rows = oldFallbackSettlements(city);

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead className="text-xs text-faint">
          <tr>
            <th className="px-3 py-2 font-normal">Settlement minute</th>
            <th className="px-3 py-2 font-normal">Settled at</th>
            <th className="px-3 py-2 font-normal">Nearest strike</th>
            <th className="px-3 py-2 font-normal">Station</th>
            <th className="px-3 py-2 font-normal">METAR used</th>
            <th className="px-3 py-2 font-normal">Received before minute</th>
            <th className="px-3 py-2 font-normal">Last 1-min reading (≤10 min)</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[13px]">
          {rows.flatMap((r) =>
            r.fallbacks.map((f) => (
              <tr key={r.event + f.station} className="border-t border-line">
                <td className="px-3 py-2 text-ink">
                  <a
                    className="underline decoration-line hover:decoration-ink"
                    href={`https://kalshi.com/markets/${report.cities[city].series.toLowerCase()}/${r.event.toLowerCase()}`}
                  >
                    {eastern(r.minute)}
                  </a>
                </td>
                <td className="px-3 py-2">{r.settled_f.toFixed(2)}°</td>
                <td className="px-3 py-2 text-muted">{r.nearest_strike?.toFixed(2)}°</td>
                <td className="px-3 py-2 text-muted">{f.station}</td>
                <td className="px-3 py-2">{f.metar_f.toFixed(2)}°</td>
                <td className="px-3 py-2 text-warn">{f.age_min.toFixed(1)} min</td>
                <td className="px-3 py-2 text-muted">
                  {f.last_one_minute_f === null ? "none" : `${f.last_one_minute_f.toFixed(2)}°`}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-5 pt-10 pb-16 sm:px-8">
      <p className="text-sm font-semibold tracking-tight text-up">Kalshi Weather Index · feed health audit</p>
      <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        KISP, one of the 8 stations in the NYC temperature index, has lost 40–90% of its 1-minute readings
        each day since Nov 15.
      </h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">
        Since then, {nycRecent.length} hourly NYC settlements used a METAR received about an hour before the
        settlement minute. A station-health alert after 30 missed minutes in a row would have fired on{" "}
        <span className="text-ink">{eastern(kispAlert)}</span>.
      </p>

      <div className="mt-6 rounded-xl border border-line bg-card p-4 text-sm leading-relaxed text-muted">
        <span className="font-semibold text-ink">What this is not:</span> {matching} of the {allSettlements}{" "}
        settled events checked have an expiration value equal to the index Kalshi published for that minute, and the oldest fallback was received{" "}
        {maxAge.toFixed(1)} minutes before its minute, inside the 75-minute limit in the contract terms. The index
        followed its methodology. This is about one station&apos;s feed, which the methodology can&apos;t fix on its own.
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <a className="rounded-full bg-up px-4 py-2 font-semibold text-black" href={REPO}>
          Audit script + data
        </a>
        <a
          className="rounded-full border border-line px-4 py-2 text-ink hover:border-faint"
          href="https://docs.kalshi.com/api-reference/live-data/get-weather-index"
        >
          Weather Index API docs
        </a>
      </div>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">1. Share of minutes fed by each station&apos;s own 1-minute reading</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Per UTC day, Nov 1–18, from <code className="font-mono text-ink">?detailed=true</code>. The rest of a
          station&apos;s minutes are a METAR fallback or missing. Hover a cell for the counts.
        </p>
        {CITY_KEYS.map((city) => (
          <div key={city} className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-ink">
              {CITY_NAMES[city]} <span className="font-normal text-faint">({report.cities[city].series})</span>
            </h3>
            <HealthGrid city={city} />
          </div>
        ))}
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
          KISP was at 100% Nov 6–14, then fell every day from Nov 15. In Chicago, KDPA runs on METAR for roughly a
          fifth of its minutes on most days: a long-running pattern, not a new outage.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">
          2. Settlements where a member was on a METAR received {report.old_fallback_min}+ minutes earlier
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          &ldquo;Received before minute&rdquo; is the settlement minute minus the reading&apos;s{" "}
          <code className="font-mono text-ink">received_at_ms</code>, so the observation itself is at least that old.
          The last column is the same station&apos;s most recent 1-minute reading in the 10 minutes before, where one
          exists, for comparison only. It isn&apos;t a claim about what the index should have been.
        </p>
        {CITY_KEYS.map((city) => (
          <div key={city} className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-ink">
              {CITY_NAMES[city]}: {oldFallbackSettlements(city).length} of {report.cities[city].settlements}{" "}
              settlements ({report.cities[city].settlements_on_fallback} used any fallback)
            </h3>
            <SettlementTable city={city} />
          </div>
        ))}
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">Suggestion 1: alert on a member&apos;s feed</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Page someone when a member misses {report.alert_after_min} 1-minute readings in a row. On this data it
            fires for KISP on {eastern(kispAlert)}, and once for every Chicago station during a shared 2-hour gap on
            Nov 9.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">Suggestion 2 (an option, not a fix)</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            When the newest METAR is old, consider preferring the station&apos;s own 1-minute reading from the last few
            minutes. Across all fallback settlements the two were close on average; they differ most in the hour-old
            cases above.
          </p>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">Rerun it</h2>
        <p className="mt-2 text-sm text-muted">
          Standard-library Python, public endpoints only, no API key. About 5 minutes for 18 days and 2 cities.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-card p-4 font-mono text-[13px] text-ink">
          {`git clone ${REPO} && cd kalshi-demo
python3 scripts/audit.py 2026-11-01 2026-11-19 > public/audit.json
python3 -m unittest discover scripts`}
        </pre>
        <p className="mt-3 text-xs text-faint">
          Data generated {eastern(report.generated_at)} from api.elections.kalshi.com/trade-api/v2: /live_data/weather/
          {"{city}"}?detailed=true and settled markets in KXTEMPNYCHS and KXTEMPCHIHS.
        </p>
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-xs text-faint">
        Unofficial demo by Cheryl Aurelia: not affiliated with Kalshi. Built only from Kalshi&apos;s public API.
      </footer>
    </main>
  );
}
