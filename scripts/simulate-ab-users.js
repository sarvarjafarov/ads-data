#!/usr/bin/env node
/**
 * MGT 697 – Simulated User Behavior
 *
 * Simulates at least 500 users hitting the experiment API.
 * Variant B is given a higher probability of interaction than Variant A,
 * so over time the bias should be observable in logged metrics.
 *
 * Usage: node scripts/simulate-ab-users.js [baseUrl]
 * Default baseUrl: http://localhost:3000
 *
 * Prerequisite: Server must be running (npm run dev).
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const NUM_USERS = 500;

// Probability of logging a "target" event (e.g. kpi_click) given variant
// Variant B has higher interaction probability so we can observe bias
const P_INTERACT_A = 0.15;
const P_INTERACT_B = 0.35;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Capture Set-Cookie from response into cookieStore (name -> value).
 */
function captureCookies(res, cookieStore) {
  const setCookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  setCookies.forEach((str) => {
    const part = str.split(';')[0];
    const match = part.match(/^([^=]+)=([^;]*)/);
    if (match) cookieStore[match[1].trim()] = match[2].trim();
  });
}

/**
 * Simulate one user: 1) GET dashboard (exposure logged), 2) maybe POST event(s) based on variant.
 * Same visitor cookie is sent on events so assignment is consistent.
 */
async function simulateOneUser(userIndex) {
  const cookieStore = {};
  const getCookieHeader = () => Object.entries(cookieStore)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  const opts = (overrides = {}) => ({
    headers: {
      'Content-Type': 'application/json',
      ...(getCookieHeader() ? { Cookie: getCookieHeader() } : {}),
      ...overrides.headers,
    },
    ...overrides,
  });

  try {
    const dashRes = await fetch(`${BASE_URL}/api/experiments/dashboard`, opts());
    captureCookies(dashRes, cookieStore);
    if (!dashRes.ok) {
      return { userIndex, ok: false, error: dashRes.status };
    }
    const dash = await dashRes.json();
    const variants = dash.variants || {};

    const kpiVariant = variants.kpi_scorecard_layout || 'A';
    const onboardingVariant = variants.guided_onboarding || 'A';

    const pKpi = kpiVariant === 'B' ? P_INTERACT_B : P_INTERACT_A;
    const pOnboarding = onboardingVariant === 'B' ? P_INTERACT_B : P_INTERACT_A;

    const events = [];
    if (Math.random() < pKpi) {
      events.push({ event: 'kpi_click', testId: 'kpi_scorecard_layout', variant: kpiVariant });
    }
    if (Math.random() < pOnboarding) {
      events.push({ event: 'tooltip_open', testId: 'guided_onboarding', variant: onboardingVariant });
    }

    for (const ev of events) {
      await fetch(`${BASE_URL}/api/experiments/events`, {
        method: 'POST',
        ...opts(),
        body: JSON.stringify(ev),
      });
    }

    return { userIndex, ok: true, variants: Object.keys(variants).length, eventsLogged: events.length };
  } catch (e) {
    return { userIndex, ok: false, error: e.message };
  }
}

async function main() {
  console.log(`Simulating ${NUM_USERS} users against ${BASE_URL}`);
  console.log(`Variant A interaction probability: ${P_INTERACT_A}; Variant B: ${P_INTERACT_B}`);
  console.log('');

  const results = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const r = await simulateOneUser(i);
    results.push(r);
    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${NUM_USERS} users simulated`);
    }
    await sleep(2);
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log('');
  console.log(`Done. Success: ${ok}, Failed: ${failed}`);
  console.log('Exposure/event data are persisted in Postgres (experiment_exposures, experiment_events) and mirrored under data/experiment-logs/.');
  console.log('To observe bias: compare event counts by variant (Variant B should have more interactions).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
