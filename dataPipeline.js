/* dataPipeline.js
   Normalization and transformation pipeline for incoming round events.
   Provides normalize(event) and transform(batch) helpers.
   Updated to include round fields: round_id, timestamp, player_count, total_wagered, payout_rate
*/

export function normalizeEvent(raw) {
  // attempt to map common fields, be tolerant of different provider shapes
  const ev = {};
  ev.id = raw.round_id || raw.roundId || raw.id || raw.rid || (`evt-${Date.now()}-${Math.floor(Math.random()*1000)}`);
  ev.source = raw.source || raw.platform || raw.source || 'unknown';
  ev.game = raw.game || raw.name || raw.gameName || 'unknown';

  // normalize timestamp robustly
  const tsCandidates = [raw.timestamp, raw.ts, raw.time, raw.date];
  let ts = null;
  for (const c of tsCandidates) {
    if (!c) continue;
    const n = (typeof c === 'number') ? c : Date.parse(String(c));
    if (!isNaN(n)) { ts = new Date(n); break; }
  }
  ev.timestamp = ts || new Date();

  // round-specific fields
  ev.round_id = String(raw.round_id || raw.roundId || raw.id || ev.id);
  ev.player_count = Number(raw.player_count || raw.players || raw.playerCount || 0);
  ev.total_wagered = Number(raw.total_wagered || raw.totalWagered || raw.wagered || 0);
  ev.payout_rate = Number(raw.payout_rate || raw.payoutRate || raw.payout || 0);

  // result and meta
  ev.result = (typeof raw.result !== 'undefined') ? raw.result : (raw.outcome || raw.value || null);
  ev.meta = raw.meta || raw.metadata || {};

  // basic integrity flags for downstream use
  ev._valid = (ev.round_id && ev.timestamp && Number.isFinite(ev.player_count) && Number.isFinite(ev.total_wagered) && Number.isFinite(ev.payout_rate));

  return ev;
}

export function transformBatch(events) {
  // basic aggregation: counts, frequencies, last-results
  const agg = { total: events.length, perGame: {}, lastByGame: {}, metrics: { valid: 0, invalid: 0 } };
  for (const e of events) {
    if (e._valid) agg.metrics.valid++; else agg.metrics.invalid++;
    const g = e.game || 'unknown';
    if (!agg.perGame[g]) agg.perGame[g] = { count: 0, freq: {}, totalWagered: 0, avgPayout: 0, lastTs: null };
    agg.perGame[g].count++;
    const r = String(e.result);
    agg.perGame[g].freq[r] = (agg.perGame[g].freq[r] || 0) + 1;
    agg.perGame[g].totalWagered += (Number(e.total_wagered) || 0);
    agg.perGame[g].avgPayout = (agg.perGame[g].avgPayout + (Number(e.payout_rate) || 0)) / 2 || (Number(e.payout_rate) || 0);
    agg.lastByGame[g] = e;
    if (!agg.perGame[g].lastTs || new Date(e.timestamp) > new Date(agg.perGame[g].lastTs)) agg.perGame[g].lastTs = e.timestamp;
  }
  return agg;
}