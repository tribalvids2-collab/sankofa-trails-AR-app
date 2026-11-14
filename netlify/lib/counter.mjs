// Sankofa Trails usage counter.
// Stores ONE tiny blob per event under  e/<barbados date>/<trail>/<type>-<n>/<random id>  and counts by listing keys.
// No IP address, no location and no device information is stored: only which trail, which trigger and the date.
// (One blob per event, instead of one shared total, means two people triggering at the same moment can never overwrite each other.)

export const TRAILS = ['riverroad', 'salters', 'tentbay', 'joesriver'];
const TYPES = ['trail', 'point'];          // trail = someone opened the trail, point = an AR point was triggered
const MAX_POINT = 30;

export function barbadosDate(now = new Date()) {
  return new Date(now.getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10);   // Barbados is UTC-4 all year
}

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });

/** Record one event. `store` is a Netlify Blobs store (anything with set(key, value)). */
export async function recordEvent(req, store, now = new Date()) {
  if (req.method !== 'POST') return reply(405, { ok: false });
  let text = '';
  try { text = await req.text(); } catch (e) { return reply(400, { ok: false }); }
  if (text.length > 300) return reply(413, { ok: false });
  let body;
  try { body = JSON.parse(text); } catch (e) { return reply(400, { ok: false }); }
  const trail = body && body.trail, type = body && body.type, n = body && body.n;
  if (!TRAILS.includes(trail) || !TYPES.includes(type) || !Number.isInteger(n) || n < 0 || n > MAX_POINT) return reply(400, { ok: false });
  if (type === 'trail' && n !== 0) return reply(400, { ok: false });
  if (type === 'point' && n < 1) return reply(400, { ok: false });
  const id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2);
  await store.set(`e/${barbadosDate(now)}/${trail}/${type}-${n}/${id}`, '1');
  return reply(200, { ok: true });
}

/** Count events: returns { total, byDate:{date:count}, byTrail:{trail:{trail:count, points:{n:count}}} } */
export async function tally(store) {
  const out = { total: 0, byDate: {}, byTrail: {} };
  for await (const page of store.list({ prefix: 'e/', paginate: true })) {
    for (const b of page.blobs) {
      const [, date, trail, tn] = b.key.split('/');
      if (!date || !trail || !tn) continue;
      const [type, nStr] = tn.split('-');
      const t = out.byTrail[trail] || (out.byTrail[trail] = { opened: 0, points: {}, byDate: {} });
      if (type === 'trail') t.opened++; else t.points[nStr] = (t.points[nStr] || 0) + 1;
      t.byDate[date] = (t.byDate[date] || 0) + 1;
      out.byDate[date] = (out.byDate[date] || 0) + 1;
      out.total++;
    }
  }
  return out;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NAMES = { riverroad: 'River Road', salters: 'Salters', tentbay: 'Tent Bay', joesriver: "Joe's River" };

export function renderReport(t, now = new Date()) {
  const today = barbadosDate(now), week = [];
  for (let i = 0; i < 7; i++) week.push(barbadosDate(new Date(now.getTime() - i * 86400000)));
  const sumDates = (m, ds) => ds.reduce((a, d) => a + (m[d] || 0), 0);
  const rows = TRAILS.map(k => {
    const x = t.byTrail[k] || { opened: 0, points: {}, byDate: {} };
    const pts = Object.keys(x.points).sort((a, b) => a - b).map(n => `Point ${esc(n)}: <b>${x.points[n]}</b>`).join(' &nbsp; ') || '<i>none yet</i>';
    const pointTotal = Object.values(x.points).reduce((a, b) => a + b, 0);
    return `<tr><td><b>${esc(NAMES[k])}</b></td><td>${x.opened}</td><td>${pointTotal}</td><td>${sumDates(x.byDate, [today])}</td><td>${sumDates(x.byDate, week)}</td><td>${pts}</td></tr>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Sankofa Trails usage</title>
<style>body{font:15px system-ui,sans-serif;margin:24px;max-width:900px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}th{background:#f2f2f2}</style>
<h1>Sankofa Trails usage</h1>
<p>Counts since the counter was switched on. Each person is counted once per trail and once per AR point per visit. Dates are Barbados time. Testing (?dev1966) is never counted.</p>
<table><tr><th>Trail</th><th>Trail opened</th><th>AR points triggered</th><th>Events today</th><th>Events, last 7 days</th><th>By point</th></tr>${rows}</table>
<p>All events: <b>${t.total}</b></p>`;
}
