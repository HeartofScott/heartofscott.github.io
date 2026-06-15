#!/usr/bin/env node
/**
 * Firewalkers — Data Centre Watch
 * Fetches UK data-centre planning applications from the PlanIt API
 * (https://www.planit.org.uk/api/) and writes a compact JSON file
 * that datacentre-watch.html renders client-side.
 *
 * Runs on GitHub Actions (see .github/workflows/datacentre-watch.yml).
 * No API key required. PlanIt is rate-limited, so we page gently.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ────────────────────────────────────────────────
const SEARCH = '"data centre" or "data center" or hyperscale or "server farm" or colocation';
const RECENT_DAYS = 365;        // look back one year
const PAGE_SIZE = 100;          // results per request
const MAX_PAGES = 12;           // safety cap (1200 results max)
const REQUEST_GAP_MS = 1500;    // be polite to the rate limiter
const OUT_PATH = path.join(__dirname, '..', 'data', 'datacentre-applications.json');
const UA = 'FirewalkersDataCentreWatch/1.0 (+https://firewalkers.earth; hello@firewalkers.earth)';

// fields we want back (keeps payload small, under the 1000kB limit)
const SELECT = [
  'name', 'uid', 'address', 'description', 'start_date',
  'authority_name', 'area_name', 'link', 'app_state',
  'app_type', 'lat', 'lng'
].join(',');

// ── Helpers ───────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url, attempt = 1) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', async () => {
        if (res.statusCode === 429 && attempt <= 4) {
          const wait = parseInt(res.headers['retry-after'] || '20', 10) * 1000;
          console.log(`  rate-limited (429); waiting ${wait}ms then retrying...`);
          await sleep(wait);
          return resolve(fetchJSON(url, attempt + 1));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse failed: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(50000, () => { req.destroy(new Error('request timeout')); });
  });
}

function buildURL(page) {
  const q = new URLSearchParams({
    search: SEARCH,
    recent: String(RECENT_DAYS),
    pg_sz: String(PAGE_SIZE),
    page: String(page),
    select: SELECT,
    sort: '-start_date',
    compress: 'on',
  });
  return `https://www.planit.org.uk/api/applics/json?${q.toString()}`;
}

// crude relevance guard — drop obvious false positives where the words
// appear incidentally (e.g. "data centre" inside an unrelated description)
function looksRelevant(rec) {
  const text = `${rec.description || ''} ${rec.app_type || ''}`.toLowerCase();
  // require a data-centre-ish term, not just the word "centre"
  return /data\s*cent(er|re)|hyperscale|server farm|colocation|colo\b/.test(text);
}

// ── Main ──────────────────────────────────────────────────
(async function main() {
  console.log('Firewalkers Data Centre Watch — fetching from PlanIt...');
  let all = [];
  let total = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = buildURL(page);
    console.log(`Page ${page}...`);
    let data;
    try {
      data = await fetchJSON(url);
    } catch (e) {
      console.error(`  page ${page} failed: ${e.message}`);
      break; // keep whatever we already have rather than fail the whole run
    }
    const recs = data.records || [];
    if (total === null) total = data.total;
    all = all.concat(recs);
    console.log(`  got ${recs.length} (running total ${all.length} of ~${total})`);
    if (data.to == null || data.total == null || data.to >= data.total - 1) break;
    if (recs.length < PAGE_SIZE) break;
    await sleep(REQUEST_GAP_MS);
  }

  // filter, de-dupe by name, sort newest first
  const seen = new Set();
  const clean = all
    .filter(looksRelevant)
    .filter(r => { if (seen.has(r.name)) return false; seen.add(r.name); return true; })
    .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));

  const out = {
    generated: new Date().toISOString(),
    source: 'PlanIt (planit.org.uk) — UK planning data',
    search_terms: SEARCH,
    lookback_days: RECENT_DAYS,
    count: clean.length,
    applications: clean,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1));
  console.log(`Wrote ${clean.length} applications to ${OUT_PATH}`);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
