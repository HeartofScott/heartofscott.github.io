#!/usr/bin/env node
/**
 * Firewalkers — Data Centre Watch
 * Fetches UK data-centre planning applications from the PlanIt API (GeoJSON),
 * tags each with UK nation + a GREEN/AMBER/RED "Firewalker traffic light",
 * merges in human-curated overrides (data/campaign-overrides.json),
 * and writes data/datacentre-applications.json.
 *
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
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'datacentre-applications.json');
const OVERRIDES_PATH = path.join(DATA_DIR, 'campaign-overrides.json');
const UA = 'FirewalkersDataCentreWatch/1.0 (+https://firewalkers.earth; hello@firewalkers.earth)';

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url, attempt = 1){
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers:{ 'User-Agent':UA, 'Accept':'application/json' } }, res => {
      let body=''; res.on('data',c=>body+=c);
      res.on('end', async () => {
        if (res.statusCode===429 && attempt<=4){
          const wait=(parseInt(res.headers['retry-after']||'20',10)||20)*1000;
          console.log(`  rate-limited; waiting ${wait}ms`); await sleep(wait);
          return resolve(fetchJSON(url, attempt+1));
        }
        if (res.statusCode!==200) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0,300)}`));
        try{ resolve(JSON.parse(body)); }catch(e){ reject(new Error('JSON parse: '+e.message)); }
      });
    });
    req.on('error',reject);
    req.setTimeout(50000,()=>req.destroy(new Error('timeout')));
  });
}

function buildURL(page){
  const q = new URLSearchParams({ search:QUERY_TERM, recent:String(RECENT_DAYS),
    pg_sz:String(PAGE_SIZE), page:String(page), compress:'on' });
  return `https://www.planit.org.uk/api/applics/geojson?${q.toString()}`;
}

function looksRelevant(p){
  const t = `${p.description||''} ${p.app_type||''} ${p.development_type||''}`.toLowerCase();
  return /data\s*cent(er|re)|hyperscale|server farm|colocation|colo\b/.test(t);
}

const SCOT=/aberdeen|angus|argyll|ayrshire|clackmannan|dumfries|dundee|east lothian|west lothian|midlothian|edinburgh|eilean|falkirk|fife|glasgow|highland|inverclyde|lanarkshire|moray|orkney|perth|renfrew|borders|shetland|stirling|dunbarton|ayr|na h-eileanan|scottish/i;
const WALES=/blaenau|bridgend|caerphilly|cardiff|carmarthen|ceredigion|conwy|denbighshire|flintshire|gwynedd|merthyr|monmouth|neath|newport|pembrokeshire|powys|rhondda|swansea|torfaen|vale of glamorgan|wrexham|anglesey|ynys mon/i;
const NI=/antrim|ards|armagh|belfast|causeway|derry|fermanagh|lisburn|mid ulster|newry/i;
function nationOf(n){ n=n||''; if(SCOT.test(n))return'Scotland'; if(WALES.test(n))return'Wales'; if(NI.test(n))return'Northern Ireland'; return'England'; }

function stateClass(s){ s=(s||'').toLowerCase();
  if(/undecided|pending|registered|consult|unresolved/.test(s))return'undecided';
  if(/permit|grant|approv|condition/.test(s))return'permitted';
  if(/refus|reject|withdraw|dismiss/.test(s))return'rejected';
  return'other'; }

/* ── Firewalker traffic light ─────────────────────────────
   Returns { light:'green|amber|red', score, reasons:[] }
   Red is reserved for live (undecided) + concerning applications.
*/
function trafficLight(p){
  const text = `${p.description||''} ${p.address||''} ${p.app_type||''}`.toLowerCase();
  const st = stateClass(p.app_state);
  let score = 0; const reasons = [];

  // concern (towards red)
  if (/hyperscale|gigawatt|\b\d{3,}\s?mw\b|hyper-scale/.test(text)){ score+=3; reasons.push('hyperscale / very large'); }
  else if (/data centre campus|data center campus|multiple data halls|data hall/.test(text)){ score+=2; reasons.push('large campus'); }
  if (/greenfield|agricultur|countryside|rural|moorland|green belt|greenbelt|farmland|field/.test(text)){ score+=3; reasons.push('greenfield / rural land'); }
  if (/water cool|evaporative|cooling tower|abstraction|potable water/.test(text)){ score+=2; reasons.push('water-cooling / abstraction'); }
  if (/heritage|listed|scheduled monument|castle|wildlife|sssi|special landscape|protected|ancient woodland|nature reserve/.test(text)){ score+=2; reasons.push('near heritage / protected land'); }
  if (/no end user|speculative|outline|statement of intent/.test(text)){ score+=2; reasons.push('speculative / no end-user'); }

  // mitigation (towards green)
  if (/brownfield|industrial estate|existing building|redevelop|former|vacant unit|business park|retrofit/.test(text)){ score-=3; reasons.push('brownfield / reuse'); }
  if (/waste heat|district heat|heat reuse|heat network|heat recovery/.test(text)){ score-=3; reasons.push('waste-heat reuse'); }
  if (/single building|small scale|minor|change of use|extension to existing/.test(text)){ score-=2; reasons.push('smaller scale'); }

  let light;
  if (st==='rejected'){ light='green'; reasons.unshift('refused — stopped'); }
  else if (st==='permitted'){ light = score>=3 ? 'amber' : 'green'; reasons.unshift('already permitted'); }
  else if (st==='undecided'){
    if (score>=4) light='red';
    else if (score>=1) light='amber';
    else light='green';
    if (light==='red') reasons.unshift('open for objection now');
  } else {
    light = score>=4 ? 'amber' : 'green';
  }
  return { light, score, reasons: reasons.slice(0,4) };
}

function writeFile(apps, note){
  const out = { generated:new Date().toISOString(), source:'PlanIt (planit.org.uk) — UK planning data',
    search_terms:QUERY_TERM, lookback_days:RECENT_DAYS, note:note||'',
    count:apps.length, applications:apps };
  fs.mkdirSync(DATA_DIR,{recursive:true});
  fs.writeFileSync(OUT_PATH, JSON.stringify(out,null,1));
  console.log(`Wrote ${apps.length} applications${note?' ('+note+')':''}`);
}

function loadOverrides(){
  try{ const o=JSON.parse(fs.readFileSync(OVERRIDES_PATH,'utf8'));
    console.log(`Loaded ${Object.keys(o.overrides||{}).length} curated overrides`);
    return o.overrides||{}; }
  catch(e){ console.log('No overrides file (that is fine):', e.message); return {}; }
}

(async function main(){
  console.log('Firewalkers Data Centre Watch — fetching (GeoJSON + traffic light)...');
  console.log('Query URL (page 1):', buildURL(1));
  const overrides = loadOverrides();
  let feats=[], total=null, firstError=null;

  for(let page=1; page<=MAX_PAGES; page++){
    try{
      const data = await fetchJSON(buildURL(page));
      const f = data.features||[];
      if(total===null) total=data.total;
      if(page===1 && f[0]) console.log('First feature keys:', Object.keys(f[0].properties||{}).join(', '));
      feats=feats.concat(f);
      console.log(`Page ${page}: got ${f.length} (total ${feats.length} of ~${total})`);
      if(data.to==null||data.total==null||data.to>=data.total-1) break;
      if(f.length<PAGE_SIZE) break;
      await sleep(REQUEST_GAP_MS);
    }catch(e){ console.error(`Page ${page} failed: ${e.message}`); if(!firstError)firstError=e.message; break; }
  }

  const seen=new Set(); let withCoords=0;
  const clean = feats
    .filter(f=>f&&f.properties&&looksRelevant(f.properties))
    .filter(f=>{const k=f.properties.name||f.properties.uid; if(seen.has(k))return false; seen.add(k); return true;})
    .map(f=>{
      const p=f.properties; let lat=null,lng=null,g=f.geometry;
      if(g&&g.type==='Point'&&Array.isArray(g.coordinates)){ lng=g.coordinates[0]; lat=g.coordinates[1]; }
      else if(g&&g.coordinates){ try{let c=g.coordinates; while(Array.isArray(c[0]))c=c[0]; lng=c[0]; lat=c[1];}catch(_){} }
      if(lat!=null&&lng!=null) withCoords++;
      const authority=p.authority_name||p.area_name||'';
      const rec = { name:p.name, uid:p.uid, address:p.address||p.location_text||'',
        description:p.description||'', start_date:p.start_date||'',
        authority_name:authority, area_name:p.area_name||'', nation:nationOf(authority),
        app_state:p.app_state||p.status||'', app_type:p.app_type||'',
        link:p.link||p.url||'', lat, lng };
      const tl = trafficLight(rec);
      rec.light=tl.light; rec.score=tl.score; rec.reasons=tl.reasons;

      // apply curated override if present (by name/uid)
      const ov = overrides[rec.name] || overrides[rec.uid];
      if(ov){
        rec.curated=true;
        if(ov.light) rec.light=ov.light;
        if(ov.reasons) rec.reasons=ov.reasons;
        if(ov.campaign) rec.campaign=ov.campaign;
        if(ov.petition) rec.petition=ov.petition;
        if(ov.note) rec.curatedNote=ov.note;
        if(ov.title) rec.curatedTitle=ov.title;
      }
      return rec;
    })
    .sort((a,b)=>{
      // red first, then amber, then green; within a light, newest first
      const order={red:0,amber:1,green:2};
      if(order[a.light]!==order[b.light]) return order[a.light]-order[b.light];
      return String(b.start_date).localeCompare(String(a.start_date));
    });

  // also fold in any curated campaigns that aren't in the live feed
  Object.keys(overrides).forEach(key=>{
    const ov=overrides[key];
    if(!ov.standalone) return;            // only if explicitly flagged standalone
    if(clean.find(r=>r.name===key||r.uid===key)) return;
    clean.unshift({ name:key, uid:key, curated:true, standalone:true,
      address:ov.address||'', description:ov.description||'',
      authority_name:ov.authority||'', nation:ov.nation||'',
      app_state:ov.app_state||'Pre-application', light:ov.light||'red',
      reasons:ov.reasons||[], campaign:ov.campaign, petition:ov.petition,
      curatedNote:ov.note, curatedTitle:ov.title, lat:ov.lat??null, lng:ov.lng??null,
      start_date:ov.start_date||'' });
  });

  const counts = clean.reduce((m,a)=>{m[a.light]=(m[a.light]||0)+1;return m;},{});
  console.log(`Fetched ${feats.length} raw, ${clean.length} relevant, ${withCoords} with coords.`);
  console.log('Traffic light:', JSON.stringify(counts));

  if(clean.length===0 && firstError) writeFile([], `fetch error: ${firstError}`);
  else writeFile(clean);
  console.log('Done.');
})().catch(e=>{ console.error('Unexpected:', e&&e.message); try{writeFile([],'unexpected: '+(e&&e.message));}catch(_){} process.exit(0); });
