/* streamClient.js
   Improved streaming client:
   - Targets /api/rounds/latest by default for round events
   - Polling with randomized small delays to simulate human navigation
   - Custom headers to reduce blocking risk
   - Exponential backoff on errors with jitter
   - Filters events by timestamp > lastCapturedTime
   - Validates incoming round shape (round_id, timestamp, player_count, total_wagered, payout_rate)
   - Maintains lightweight metrics for quality monitoring
*/

function _nowIso() { return new Date().toISOString(); }
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export class StreamClient {
  constructor(sourceUrl = '/api/rounds/latest', onEvent) {
    this.sourceUrl = sourceUrl;
    this.onEvent = onEvent;
    this.es = null;
    this.pollHandle = null;
    this.running = false;

    // state for filtering and retries
    this.lastCapturedTime = 0; // epoch ms
    this.backoffMs = 1000; // start backoff
    this.maxBackoff = 60000;
    this.metrics = {
      fetched: 0,
      accepted: 0,
      rejected: 0,
      errors: 0,
      lastFetchAt: null
    };
  }

  start() {
    // Try SSE only if explicitly pointing to an SSE endpoint (heuristic: contains /sse or /events)
    if (this.sourceUrl.includes('/sse') || this.sourceUrl.includes('/events')) {
      try {
        if (window.EventSource) {
          this.es = new EventSource(this.sourceUrl);
          this.es.onmessage = (evt) => {
            try {
              const payload = JSON.parse(evt.data);
              this._handleRaw(payload);
            } catch (e) {
              this.metrics.errors++;
            }
          };
          this.es.onerror = () => {
            this.stop();
            this._startPolling();
          };
          return;
        }
      } catch (e) {
        // fallthrough to polling
      }
    }
    this._startPolling();
  }

  stop() {
    this.running = false;
    if (this.es) {
      try { this.es.close(); } catch (e) {}
      this.es = null;
    }
    if (this.pollHandle) {
      clearTimeout(this.pollHandle);
      this.pollHandle = null;
    }
  }

  async _startPolling() {
    if (this.running) return;
    this.running = true;
    this.backoffMs = 1000;
    while (this.running) {
      try {
        // fixed short delay before each request (deterministic, non-simulated)
        const humanDelay = 500;
        await _sleep(humanDelay);

        const headers = {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Client-Time': _nowIso(),
          'User-Agent': navigator.userAgent.slice(0, 120) // trimmed UA
        };

        const resp = await fetch(this.sourceUrl, {
          method: 'GET',
          cache: 'no-store',
          headers,
          mode: 'cors'
        });

        this.metrics.lastFetchAt = Date.now();

        if (!resp.ok) {
          // treat non-200 as transient and increment error counters
          this.metrics.errors++;
          throw new Error(`HTTP ${resp.status}`);
        }

        const json = await resp.json().catch(()=>null);
        this.metrics.fetched++;

        // normalize possible list or single object response
        const items = Array.isArray(json) ? json : (json && json.data ? json.data : [json]);

        for (const raw of (items || [])) {
          try {
            // basic filtering by timestamp > lastCapturedTime
            const ts = this._extractTimestamp(raw);
            if (!ts) { this.metrics.rejected++; continue; }
            if (ts <= this.lastCapturedTime) { continue; }

            // validate integrity of the record
            if (!this._validateRound(raw)) { this.metrics.rejected++; continue; }

            // update lastCapturedTime and emit
            this.lastCapturedTime = Math.max(this.lastCapturedTime, ts);
            this.metrics.accepted++;
            this.onEvent && this.onEvent(raw);
          } catch (inner) {
            this.metrics.errors++;
          }
        }

        // reset backoff on success
        this.backoffMs = 1000;

        // fixed spacing between successful polls (deterministic)
        const gap = 2000;
        await _sleep(gap);
      } catch (err) {
        this.metrics.errors++;
        // exponential backoff with fixed small jitter replacement (deterministic)
        const jitter = 250;
        const wait = Math.min(this.maxBackoff, this.backoffMs + jitter);
        await _sleep(wait);
        this.backoffMs = Math.min(this.maxBackoff, this.backoffMs * 2);
        // continue loop; will retry until stopped
      }
    }
  }

  _extractTimestamp(raw) {
    // Attempt multiple common timestamp fields and return epoch ms or null
    const candidates = [raw.timestamp, raw.ts, raw.time, raw.date];
    for (const c of candidates) {
      if (!c) continue;
      const n = (typeof c === 'number') ? c : Date.parse(String(c));
      if (!isNaN(n)) return n;
    }
    return null;
  }

  _validateRound(raw) {
    // required fields: round_id, timestamp, player_count, total_wagered, payout_rate
    if (!raw) return false;
    const roundId = raw.round_id || raw.roundId || raw.id;
    const ts = this._extractTimestamp(raw);
    const playerCount = Number(raw.player_count || raw.players || raw.playerCount);
    const totalWagered = Number(raw.total_wagered || raw.totalWagered || raw.wagered);
    const payoutRate = Number(raw.payout_rate || raw.payoutRate || raw.payout);

    if (!roundId) return false;
    if (!ts || ts <= 0) return false;
    if (!Number.isFinite(playerCount) || playerCount < 0) return false;
    if (!Number.isFinite(totalWagered) || totalWagered < 0) return false;
    if (!Number.isFinite(payoutRate) || payoutRate < 0 || payoutRate > 1000) return false;

    // optionally attach normalized fields for downstream consumers
    raw.round_id = String(roundId);
    raw.timestamp = new Date(ts).toISOString();
    raw.player_count = playerCount;
    raw.total_wagered = totalWagered;
    raw.payout_rate = payoutRate;
    return true;
  }

  // Expose metrics snapshot
  getMetrics() {
    return Object.assign({}, this.metrics, { lastCapturedTime: this.lastCapturedTime });
  }
}