#!/usr/bin/env node
const { performance } = require('perf_hooks');
const { query } = require('../src/config/database');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const WORKERS = parseInt(process.env.LOAD_WORKERS || '30', 10);
const ITERATIONS = parseInt(process.env.LOAD_ITERATIONS || '20', 10);
const EVENT_PROBABILITY = 0.4;
const TIME_BETWEEN = parseInt(process.env.LOAD_DELAY || '30', 10);
const DB_CHECK_ENABLED = process.env.LOAD_TEST_DB === 'true';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function captureCookies(res, cookieStore) {
  const cookieHeaders = res.headers.get('set-cookie');
  if (!cookieHeaders) return;
  const entries = Array.isArray(cookieHeaders) ? cookieHeaders : cookieHeaders.split(',');
  entries.forEach((header) => {
    const part = header.split(';')[0];
    const match = part.match(/^([^=]+)=([^;]*)/);
    if (match) {
      cookieStore[match[1].trim()] = match[2].trim();
    }
  });
}

function cookieHeader(cookieStore) {
  return Object.entries(cookieStore)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function requestOptions(cookieStore) {
  const headerValue = cookieHeader(cookieStore);
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(headerValue ? { Cookie: headerValue } : {}),
    },
  };
}

async function hitDashboard(cookieStore) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/api/experiments/dashboard`, requestOptions(cookieStore));
  captureCookies(res, cookieStore);
  const duration = performance.now() - start;
  let payload = null;
  try {
    payload = await res.clone().json();
  } catch {
    payload = null;
  }
  return { ok: res.ok, status: res.status, duration, url: '/api/experiments/dashboard', body: payload };
}

async function postEvent(cookieStore, body) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/api/experiments/events`, {
    method: 'POST',
    ...requestOptions(cookieStore),
    body: JSON.stringify(body),
  });
  captureCookies(res, cookieStore);
  const duration = performance.now() - start;
  return { ok: res.ok, status: res.status, duration, url: '/api/experiments/events' };
}

async function postBulkEvents(cookieStore, payload) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/api/experiments/bulk-events`, {
    method: 'POST',
    ...requestOptions(cookieStore),
    body: JSON.stringify({ events: payload }),
  });
  captureCookies(res, cookieStore);
  const duration = performance.now() - start;
  return { ok: res.ok, status: res.status, duration, url: '/api/experiments/bulk-events' };
}

async function hitPricing(cookieStore) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/api/experiments/pricing-view`, {
    ...requestOptions(cookieStore),
  });
  captureCookies(res, cookieStore);
  const duration = performance.now() - start;
  return { ok: res.ok, status: res.status, duration, url: '/api/experiments/pricing-view' };
}

const stats = {
  requests: 0,
  successes: 0,
  failures: 0,
  latencies: [],
  errors: [],
  byUrl: {},
};

function record(result) {
  stats.requests += 1;
  stats.latencies.push(result.duration);
  stats.byUrl[result.url] = stats.byUrl[result.url] || { total: 0, successes: 0, failures: 0 };
  stats.byUrl[result.url].total += 1;
  if (result.ok) {
    stats.successes += 1;
    stats.byUrl[result.url].successes += 1;
  } else {
    stats.failures += 1;
    stats.byUrl[result.url].failures += 1;
    stats.errors.push(result.status);
  }
}

async function worker(id) {
  const cookieStore = {};
  for (let i = 0; i < ITERATIONS; i += 1) {
    try {
      const dash = await hitDashboard(cookieStore);
      record(dash);

      if (Math.random() < EVENT_PROBABILITY) {
        const variant = dash.body?.variants?.kpi_scorecard_layout || 'A';
        const payload = {
          event: 'kpi_click',
          testId: 'kpi_scorecard_layout',
          variant,
        };
        const eventResult = await postEvent(cookieStore, payload);
        record(eventResult);
      }

      if (Math.random() < 0.2) {
        const bulkPayload = [
          {
            event: 'tooltip_open',
            testId: 'guided_onboarding',
            variant: dash.body?.variants?.guided_onboarding || 'A',
          },
          {
            event: 'kpi_click',
            testId: 'kpi_scorecard_layout',
            variant: dash.body?.variants?.kpi_scorecard_layout || 'A',
          },
        ];
        const bulkResult = await postBulkEvents(cookieStore, bulkPayload);
        record(bulkResult);
      }

      const pricingResult = await hitPricing(cookieStore);
      record(pricingResult);

      await sleep(TIME_BETWEEN);
    } catch (error) {
      stats.failures += 1;
      stats.errors.push(error.message);
    }
  }
}

async function main() {
  console.log(`Running load test against ${BASE_URL}`);
  console.log(`${WORKERS} workers x ${ITERATIONS} iterations`);
  const workers = [];
  for (let i = 0; i < WORKERS; i += 1) {
    workers.push(worker(i));
  }
  await Promise.all(workers);

  const latencies = stats.latencies.slice().sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  console.log('\n=== Load Test Summary ===');
  console.log(`Requests: ${stats.requests}`);
  console.log(`Successes: ${stats.successes}`);
  console.log(`Failures: ${stats.failures}`);
  console.log(`Latencies (ms): p50=${p50.toFixed(2)}, p95=${p95.toFixed(2)}, p99=${p99.toFixed(2)}`);
  console.log('Errors:', stats.errors.slice(0, 10));
  Object.entries(stats.byUrl).forEach(([url, summary]) => {
    const rate = ((summary.successes / summary.total) * 100).toFixed(1);
    console.log(`  ${url}: ${summary.total} requests, ${rate}% success`);
  });

  if (DB_CHECK_ENABLED) {
    try {
      const expRes = await query('SELECT COUNT(*)::int AS count FROM experiment_exposures');
      const evtRes = await query('SELECT COUNT(*)::int AS count FROM experiment_events');
      console.log(`DB counts: exposures=${expRes.rows[0]?.count ?? 'NA'} events=${evtRes.rows[0]?.count ?? 'NA'}`);
    } catch (error) {
      console.warn('Load test warning: could not read experiment tables:', error.message);
    }
  } else {
    console.log('DB check skipped (set LOAD_TEST_DB=true to enable)');
  }
}

main().catch((error) => {
  console.error('Load test failed:', error);
});
