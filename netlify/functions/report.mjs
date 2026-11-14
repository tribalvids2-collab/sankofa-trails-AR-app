import { getStore } from '@netlify/blobs';
import { tally, renderReport } from '../lib/counter.mjs';

// Private usage page for the owner:  https://<your site>/api/report?key=<REPORT_KEY>
// REPORT_KEY is set in Netlify (Site configuration > Environment variables). It is never written in the code.
function same(a, b) {   // compare without leaking where the strings differ
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export default async (req) => {
  const secret = (globalThis.Netlify && Netlify.env.get('REPORT_KEY')) || process.env.REPORT_KEY || '';
  const given = new URL(req.url).searchParams.get('key') || '';
  const h = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
  if (!secret) return new Response('The report is not switched on yet: add REPORT_KEY in Netlify.', { status: 503, headers: h });
  if (!same(given, secret)) return new Response('Not found', { status: 404, headers: h });
  const t = await tally(getStore('counts'));
  return new Response(renderReport(t), { status: 200, headers: { ...h, 'content-type': 'text/html; charset=utf-8' } });
};
export const config = { path: '/api/report' };
