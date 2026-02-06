/**
 * Experiment log store: exposures and events.
 * Uses JSON files for persistence (suitable for analysis; not for production scale).
 * In-memory arrays are kept in sync for fast reads during simulation.
 */

const fs = require('fs');
const path = require('path');
const { writeFile } = require('node:fs/promises');
const { query } = require('../config/database');

const DATA_DIR = path.join(__dirname, '../../data/experiment-logs');
const EXPOSURES_FILE = path.join(DATA_DIR, 'exposures.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

// In-memory store for current process (also written to disk)
let exposures = [];
let events = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFromDisk() {
  ensureDataDir();
  try {
    if (fs.existsSync(EXPOSURES_FILE)) {
      const raw = fs.readFileSync(EXPOSURES_FILE, 'utf8');
      exposures = raw.trim() ? JSON.parse(raw) : [];
    }
  } catch (e) {
    console.warn('experimentStore: could not load exposures:', e.message);
    exposures = [];
  }
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      const raw = fs.readFileSync(EVENTS_FILE, 'utf8');
      events = raw.trim() ? JSON.parse(raw) : [];
    }
  } catch (e) {
    console.warn('experimentStore: could not load events:', e.message);
    events = [];
  }
}

function writeExposures() {
  ensureDataDir();
  const payload = JSON.stringify(exposures, null, 2);
  return writeFile(EXPOSURES_FILE, payload, 'utf8')
    .catch((e) => {
      console.error('experimentStore: could not write exposures:', e.message);
    });
}

function writeEvents() {
  ensureDataDir();
  const payload = JSON.stringify(events, null, 2);
  return writeFile(EVENTS_FILE, payload, 'utf8')
    .catch((e) => {
      console.error('experimentStore: could not write events:', e.message);
    });
}

async function persistExposureToDb(record) {
  const timestamp = record.timestamp || new Date().toISOString();
  try {
    await query(
      `INSERT INTO experiment_exposures (
         user_or_session_id,
         test_id,
         variant,
         recorded_at
       ) VALUES ($1, $2, $3, $4)`,
      [
        record.user_or_session_id,
        record.test_id,
        record.variant,
        timestamp,
      ]
    );
  } catch (error) {
    console.warn('experimentStore: could not persist exposure to DB:', error.message);
  }
}

async function persistEventToDb(record) {
  const timestamp = record.timestamp || new Date().toISOString();
  try {
    await query(
      `INSERT INTO experiment_events (
         user_or_session_id,
         event_name,
         test_id,
         variant,
         recorded_at
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        record.user_or_session_id,
        record.event_name,
        record.test_id,
        record.variant,
        timestamp,
      ]
    );
  } catch (error) {
    console.warn('experimentStore: could not persist event to DB:', error.message);
  }
}

async function fetchExposures() {
  try {
    const result = await query(
      `SELECT user_or_session_id,
              test_id,
              variant,
              recorded_at AS timestamp
       FROM experiment_exposures
       ORDER BY recorded_at ASC`
    );
    return result.rows;
  } catch (error) {
    console.warn('experimentStore: could not load exposures from DB:', error.message);
    return getExposures();
  }
}

async function fetchEvents() {
  try {
    const result = await query(
      `SELECT user_or_session_id,
              event_name,
              test_id,
              variant,
              recorded_at AS timestamp
       FROM experiment_events
       ORDER BY recorded_at ASC`
    );
    return result.rows;
  } catch (error) {
    console.warn('experimentStore: could not load events from DB:', error.message);
    return getEvents();
  }
}

// Load on first require
loadFromDisk();

/**
 * Add an exposure record (user/session exposed to a test variant).
 * @param {Object} record - { user_or_session_id, test_id, variant, timestamp }
 */
function addExposure(record) {
  exposures.push({
    user_or_session_id: record.user_or_session_id,
    test_id: record.test_id,
    variant: record.variant,
    timestamp: record.timestamp || new Date().toISOString(),
  });
  writeExposures();
  persistExposureToDb(record);
}

/**
 * Add an event record (user action, optionally tied to a test/variant).
 * @param {Object} record - { user_or_session_id, event_name, test_id?, variant?, timestamp }
 */
function addEvent(record) {
  const entry = {
    user_or_session_id: record.user_or_session_id,
    event_name: record.event_name,
    test_id: record.test_id ?? null,
    variant: record.variant ?? null,
    timestamp: record.timestamp || new Date().toISOString(),
  };
  events.push(entry);
  writeEvents();
  persistEventToDb(entry);
}

/**
 * Get all exposure logs (for analysis).
 */
function getExposures() {
  return [...exposures];
}

/**
 * Get all event logs (for analysis).
 */
function getEvents() {
  return [...events];
}

/**
 * Get tests configuration (from tests.json).
 */
function getTestsConfig() {
  const testsPath = path.join(__dirname, '../../tests.json');
  try {
    const raw = fs.readFileSync(testsPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('experimentStore: could not load tests.json:', e.message);
    return { experiments: [] };
  }
}

/**
 * Aggregate A/B results for admin: exposures and events per test per variant,
 * plus conversion rate (events / exposures) per variant.
 */
async function getResults() {
  const config = getTestsConfig();
  const exposureList = await fetchExposures();
  const eventList = await fetchEvents();

  const results = (config.experiments || []).map((exp) => {
    const byVariant = { A: { exposures: 0, events: 0 }, B: { exposures: 0, events: 0 } };

    exposureList
      .filter((e) => e.test_id === exp.test_id)
      .forEach((e) => {
        if (byVariant[e.variant] != null) {
          byVariant[e.variant].exposures += 1;
        }
      });

    eventList
      .filter((e) => e.test_id === exp.test_id && e.event_name === exp.target_event)
      .forEach((e) => {
        if (e.variant && byVariant[e.variant] != null) {
          byVariant[e.variant].events += 1;
        }
      });

    const variants = {
      A: {
        ...byVariant.A,
        conversion_rate: byVariant.A.exposures
          ? (byVariant.A.events / byVariant.A.exposures)
          : 0,
      },
      B: {
        ...byVariant.B,
        conversion_rate: byVariant.B.exposures
          ? (byVariant.B.events / byVariant.B.exposures)
          : 0,
      },
    };

    return {
      test_id: exp.test_id,
      description: exp.description,
      target_event: exp.target_event,
      variants: exp.variants,
      results: variants,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    total_exposures: exposureList.length,
    total_events: eventList.length,
    experiments: results,
  };
}

module.exports = {
  addExposure,
  addEvent,
  getExposures,
  getEvents,
  getTestsConfig,
  getResults,
  EXPOSURES_FILE,
  EVENTS_FILE,
};
