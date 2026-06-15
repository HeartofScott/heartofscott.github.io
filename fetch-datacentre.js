#!/usr/bin/env node
/**
 * Firewalkers — Data Centre Watch
 * Fetches UK data-centre planning applications from the PlanIt API (GeoJSON),
 * tags each with its UK nation, and writes data/datacentre-applications.json.
 *
 * Uses the GEOJSON endpoint so we get coordinates (for the map).
 * Hardened: never fails the build; always writes a valid file.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

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
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0,300)}`));
        try { resolve(JSON.parse(body)); }
        catch(e){ reject(new Error(`JSON parse failed: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(50000, () => req.destroy(new Error('request timeout')));
  });
}

function buildURL(page){
  const q = new URLSearchParams({
    search: QUERY_TERM,
    recent: String(RECENT_DAYS),
    pg_sz: String(PAGE_SIZE),
    page: String(page),
    compress: 'on',
  });
  // GEOJSON so we receive geometry/coordinates for the map
  return `https://www.planit.org.uk/api/applics/geojson?${q.toString()}`;
}

function looksRelevant(props){
  const text = `${props.description || ''} ${props.app_type || ''} ${props.development_type || ''}`.toLowerCase();
  return /data\s*cent(er|re)|hyperscale|server farm|colocation|colo\b/.test(text);
}

// Map a PlanIt authority/area name to its UK nation, mostly by known Scottish/
// Welsh/NI council names; everything else defaults to England. Coordinates,
// where present, refine this (Scotland lat > ~54.6, Wales lng < ~-2.6 roughly),
// but name-matching is the primary method.
const SCOT = /aberdeen|angus|argyll|ayrshire|clackmannan|dumfries|dundee|east lothian|west lothian|midlothian|edinburgh|eilean|falkirk|fife|glasgow|highland|inverclyde|lanarkshire|moray|orkney|perth|renfrew|borders|shetland|stirling|dunbarton|ayr|na h-eileanan|scottish/i;
const WALES = /blaenau|bridgend|caerphilly|cardiff|carmarthen|ceredigion|conwy|denbighshire|flintshire|gwynedd|merthyr|monmouth|neath|newport|pembrokeshire|powys|rhondda|swansea|torfaen|vale of glamorgan|wrexham|anglesey|ynys mon/i;
const NI = /antrim|ards|armagh|belfast|causeway|derry|fermanagh|lisburn|mid ulster|mid and east antrim|newry|ards and north down/i;

function nationOf(name, lat){
  const n = name || '';
  if (SCOT.test(n)) return 'Scotland';
  if (WALES.test(n)) return 'Wales';
  if (NI.test(n)) return 'Northern Ireland';
  return 'England';
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
  console.log(`Wrote ${apps.length} applications${note ? ' ('+note+')' : ''}`);
}

(async function main(){
  console.log('Firewalkers Data Centre Watch — fetching from PlanIt (GeoJSON)...');
  console.log('Query URL (page 1):', buildURL(1));
  let feats = [];
  let total = null, firstError = null;

  for (let page = 1; page <= MAX_PAGES; page++){
    try {
      const data = await fetchJSON(buildURL(page));
      const fs_ = data.features || [];
      if (total === null) total = data.total;
      if (page === 1 && fs_[0]) console.log('First feature property keys:', Object.keys(fs_[0].properties || {}).join(', '));
      feats = feats.concat(fs_);
      console.log(`Page ${page}: got ${fs_.length} (running total ${feats.length} of ~${total})`);
      if (data.to == null || data.total == null || data.to >= data.total - 1) break;
      if (fs_.length < PAGE_SIZE) break;
      await sleep(REQUEST_GAP_MS);
    } catch(e){
      console.error(`Page ${page} failed: ${e.message}`);
      if (!firstError) firstError = e.message;
      break;
    }
  }

  const seen = new Set();
  let withCoords = 0;
  const clean = feats
    .filter(f => f && f.properties && looksRelevant(f.properties))
    .filter(f => { const k = f.properties.name || f.properties.uid; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(f => {
      const p = f.properties;
      let lat = null, lng = null;
      const g = f.geometry;
      if (g && g.type === 'Point' && Array.isArray(g.coordinates)){
        lng = g.coordinates[0]; lat = g.coordinates[1];
      } else if (g && g.coordinates){
        // polygon/multipolygon — take first coordinate as a rough marker
        try { let c = g.coordinates; while (Array.isArray(c[0])) c = c[0]; lng = c[0]; lat = c[1]; } catch(_){}
      }
      if (lat != null && lng != null) withCoords++;
      const authority = p.authority_name || p.area_name || '';
      return {
        name: p.name, uid: p.uid,
        address: p.address || p.location_text || '',
        description: p.description || '',
        start_date: p.start_date || '',
        authority_name: authority,
        area_name: p.area_name || '',
        nation: nationOf(authority, lat),
        app_state: p.app_state || p.status || '',
        app_type: p.app_type || '',
        link: p.link || p.url || '',
        lat: lat, lng: lng,
      };
    })
    .sort((a,b) => String(b.start_date).localeCompare(String(a.start_date)));

  console.log(`Fetched ${feats.length} raw, ${clean.length} relevant, ${withCoords} with coordinates.`);
  const byNation = clean.reduce((m,a)=>{m[a.nation]=(m[a.nation]||0)+1;return m;},{});
  console.log('By nation:', JSON.stringify(byNation));

  if (clean.length === 0 && firstError) writeFile([], `fetch error: ${firstError}`);
  else writeFile(clean);
  console.log('Done.');
})().catch(e => {
  console.error('Unexpected error:', e && e.message);
  try { writeFile([], `unexpected error: ${e && e.message}`); } catch(_){}
  process.exit(0);
});
