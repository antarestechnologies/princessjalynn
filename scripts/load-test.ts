import { readFileSync } from "node:fs";
import autocannon from "autocannon";

/**
 * Load test at ~10x expected peak (PLAN.md: peak ~20 concurrent, so 200 connections).
 * Each connection is a different fan (own session cookie), so per-user rate limits behave
 * as they would in reality. Usage:
 *   npx tsx scripts/load-test.ts http://localhost:3000 load-sessions.json [connections] [seconds]
 */
const [base, seedFile, connArg, durArg] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedFile, "utf8")) as {
  gate: string;
  sids: string[];
  postIds: string[];
  mediaIds: string[];
};
const connections = Number(connArg ?? 200);
const duration = Number(durArg ?? 30);

type Scenario = { name: string; method: "GET" | "POST"; path: (i: number) => string };
const scenarios: Scenario[] = [
  { name: "GET /api/health", method: "GET", path: () => "/api/health" },
  { name: "GET /feed (SSR, entitlement + 2257 checks)", method: "GET", path: () => "/feed" },
  {
    name: "GET /p/[id] (SSR, issues signed grants, writes)",
    method: "GET",
    path: (i) => `/p/${seed.postIds[i % seed.postIds.length]}`,
  },
  {
    name: "POST /api/media/[id]/playback (token refresh)",
    method: "POST",
    path: (i) => `/api/media/${seed.mediaIds[i % seed.mediaIds.length]}/playback`,
  },
];

async function run(s: Scenario) {
  let next = 0;
  const host = new URL(base).host;
  const result = await autocannon({
    url: base,
    connections,
    duration,
    // Route and identity are set on EVERY request; each connection keeps one fan for its life.
    requests: [
      {
        setupRequest: (req, context) => {
          const ctx = context as { i?: number };
          ctx.i ??= next++;
          const i = ctx.i;
          return {
            ...req,
            method: s.method,
            path: s.path(i),
            headers: {
              cookie: `ag=${seed.gate}; sid=${seed.sids[i % seed.sids.length]}`,
              origin: base,
              host,
            },
          };
        },
      },
    ],
  });
  return {
    scenario: s.name,
    requests: result.requests.total,
    rps: Math.round(result.requests.average),
    p50: result.latency.p50,
    p90: result.latency.p90,
    p99: result.latency.p99,
    max: result.latency.max,
    errors: result.errors + result.timeouts,
    non2xx: result.non2xx,
  };
}

(async () => {
  const rows = [];
  const only = process.env.LOAD_ONLY;
  for (const s of scenarios.filter((x) => !only || x.name.includes(only))) {
    const r = await run(s);
    rows.push(r);
    console.log(JSON.stringify(r));
  }
  console.log(
    "\n| Scenario | Requests | Req/s | p50 ms | p90 ms | p99 ms | Max ms | Errors | Non-2xx |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const r of rows)
    console.log(
      `| ${r.scenario} | ${r.requests} | ${r.rps} | ${r.p50} | ${r.p90} | ${r.p99} | ${r.max} | ${r.errors} | ${r.non2xx} |`,
    );
})();
