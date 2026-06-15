#!/usr/bin/env node
/**
 * Firewalkers — Data Centre Watch
 * Fetches UK data-centre planning applications from the PlanIt API
 * (https://www.planit.org.uk/api/) and writes data/datacentre-applications.json
 *
 * Hardened: never throws the build. On any fetch problem it still writes a
 * valid file (with whatever it managed to gather, or an empty list) and exits 0,
 * logging loudly so the Actions log explains what happened.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ────────────────────────────────────────────────
// Simple, robust query: one phrase. We do the OR-widening in the filter,
// because PlanIt's multi-phrase "or" syntax is easy to mis-encode.
const QUERY_TERM = 'data centre';
const RECENT_DAYS = 365;
const PAGE_SIZE = 100;
const MAX_PAGES = 12;
const REQUEST_GAP_MS = 1500;
const OUT_PATH = path.join(__dirname, '..', 'data', 'datacentre-applications.json');
const UA = 'FirewalkersDataCentreWatch/1.0 (+https://firewalkers.earth; hello@firewalkers.earth)';

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url, attempt = 1){
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers:{ 'User-Agent':UA, 'Accept':'application/json' } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', async () => {
        if (res.statusCode === 429 && attempt <= 4){
          const wait = (parseInt(res.headers['retry-after'] || '20', 10) || 20) * 1000;
          console.log(`  rate-limited (429); waiting ${wait}ms then retrying...`);
          await sleep(wait);
          return resolve(fetchJSON(url, attempt + 1));
        }
        if (res.statusCode !== 200){
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0,300)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch(e){ reject(new Error(`JSON parse failed: ${e.message} :: ${body.slice(0,200)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(50000, () => req.destroy(new Error('request timeout')));
  });
}

function buildURL(page){
  const q = new URLSearchParams({
    search: QUERY_TERM,                 // single, safe term
    recent: String(RECENT_DAYS),
    pg_sz: String(PAGE_SIZE),
    page: String(page),
    compress: 'on',
  });
  // NOTE: no 'select' — we take all fields so we can't miss a renamed one.
  return `https://www.planit.org.uk/api/applics/json?${q.toString()}`;
}

// widen here instead of in the query
function looksRelevant(rec){
  const text = `${rec.description || ''} ${rec.app_type || ''} ${rec.development_type || ''}`.toLowerCase();
  return /data\s*cent(er|re)|hyperscale|server farm|colocation|colo\b/.test(text);
}

function writeFile(apps, note){
  const out = {
    generated: new Date().toISOString(),
    source: 'PlanIt (planit.org.uk) — UK planning data',
    search_terms: QUERY_TERM,
    lookback_days: RECENT_DAYS,
    note: note || '',
    count: apps.length,
    applications: apps,
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1));
  console.log(`Wrote ${apps.length} applications to ${OUT_PATH}${note ? ' ('+note+')' : ''}`);
}

(async function main(){
  console.log('Firewalkers Data Centre Watch — fetching from PlanIt...');
  console.log('Query URL (page 1):', buildURL(1));
  let all = [];
  let total = null;
  let firstError = null;

  for (let page = 1; page <= MAX_PAGES; page++){
    try {
      const data = await fetchJSON(buildURL(page));
      const recs = data.records || [];
      if (total === null) total = data.total;
      // log the shape of the first record so we can see real field names
      if (page === 1 && recs[0]) {
        console.log('First record keys:', Object.keys(recs[0]).join(', '));
      }
      all = all.concat(recs);
      console.log(`Page ${page}: got ${recs.length} (running total ${all.length} of ~${total})`);
      if (data.to == null || data.total == null || data.to >= data.total - 1) break;
      if (recs.length < PAGE_SIZE) break;
      await sleep(REQUEST_GAP_MS);
    } catch(e){
      console.error(`Page ${page} failed: ${e.message}`);
      if (!firstError) firstError = e.message;
      break; // stop paging, keep what we have
    }
  }

  const seen = new Set();
  const clean = all
    .filter(looksRelevant)
    .filter(r => { const k = r.name || r.uid; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(r => ({
      name: r.name, uid: r.uid,
      address: r.address || r.location_text || '',
      description: r.description || '',
      start_date: r.start_date || '',
      authority_name: r.authority_name || r.area_name || '',
      area_name: r.area_name || '',
      app_state: r.app_state || r.status || '',
      app_type: r.app_type || '',
      link: r.link || r.url || '',
      lat: r.lat, lng: r.lng,
    }))
    .sort((a,b) => String(b.start_date).localeCompare(String(a.start_date)));

  console.log(`Fetched ${all.length} raw, ${clean.length} relevant after filtering.`);

  // Always write a valid file. Never fail the build.
  if (clean.length === 0 && firstError){
    writeFile([], `fetch error: ${firstError}`);
  } else {
    writeFile(clean);
  }
  console.log('Done.');
})().catch(e => {
  // last-resort safety: still write something valid, still exit 0
  console.error('Unexpected error:', e && e.message);
  try { writeFile([], `unexpected error: ${e && e.message}`); } catch(_){}
  process.exit(0);
});
