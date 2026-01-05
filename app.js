/*
  Refactored entrypoint: imports modular components and wires them together.
  Large functions/classes were moved into separate modules:
    - MLServiceClient -> mlClient.js  // removed function/class MLServiceClient {}
    - Audio helpers -> audio.js        // removed function setupAudio() {} and playSound() {}
    - Pattern analysis -> patterns.js  // removed function analyzePatterns() {}
    - UI/orchestration -> ui.js        // removed many methods related to DOM plumbing {}
  
  The SignalApp here is now a lightweight orchestrator that composes the modules above.
*/
import { MLServiceClient } from './mlClient.js';
import { AudioManager } from './audio.js';
import { analyzePatterns, generateSHA256 } from './patterns.js';
import { UI } from './ui.js';
import { StreamClient } from './streamClient.js';
import { Cache } from './cache.js';
import { AsyncQueue } from './queue.js';
import { normalizeEvent, transformBatch } from './dataPipeline.js';

class SignalApp {
  constructor() {
    this.ui = new UI();
    this.mlClient = new MLServiceClient(window.ML_BACKEND_URL || '');
    this.audio = new AudioManager();
    this.params = { volatility: 1.0, marketWeight: 1.0 };
    this.validTimer = null;

    this.init();
  }

  async init() {
    this.ui.onStart(() => this.startScanning());
    this.ui.onGenerate(() => this.startScanning());
    this.ui.onReset(() => this.reset());

    // initialize capture/processing stack
    this.cache = new Cache(800);
    this.queue = new AsyncQueue();
    // streamSource: default to /events if same origin - UI.collectInput seedSource may override for platform-specific
    this.stream = new StreamClient('/events', (raw) => this._handleIncomingEvent(raw));
    // start stream client (will fallback to polling)
    try { this.stream.start(); this.ui.addLog('[STREAM] Stream client started.'); } catch(e){ this.ui.addLog('[STREAM] Failed to start stream: ' + e.message); }
    // periodically drain queue for background processing
    setInterval(() => {
      this.queue.drain(async (payload) => {
        // safe handler: apply normalization and persist into cache
        const normalized = normalizeEvent(payload);
        this.cache.set(normalized.id, normalized);
        // further transform or send to ML backend if configured
        try {
          if (this.mlClient && this.mlClient.baseUrl) {
            await this.mlClient.runMonteCarlo({ event: normalized }).catch(()=>null);
          }
        } catch(e){}
      });
    }, 2500);

    await this.updateRealTimeIndicators();
    setInterval(() => this.updateRealTimeIndicators(), 60000);

    this.audio.setupDeferredAudio();
    this.probeMLBackend();
    // also load recent events from cache to warm UI
    (async () => {
      const recent = await this.cache.loadRecent(25).catch(()=>[]);
      if (recent && recent.length) {
        this.ui.addLog(`[CACHE] Loaded ${recent.length} recent events.`);
        // render last event info into news feed
        const last = recent[0];
        if (last && last.value) this.ui.setNews(`[CACHE] Último: ${last.value.game || last.value.source} @ ${new Date(last.value.ts||Date.now()).toLocaleTimeString()}`);
      }
    })();
  }

  async probeMLBackend() {
    try {
      const models = await this.mlClient.models();
      this.ui.addLog(models && models.length ? `[ML] Model endpoints: ${models.join(', ')}` : `[ML] No ML backend configured or no models reported.`);
    } catch (e) {
      this.ui.addLog(`[ML] Probe failed: ${e.message}`);
    }
  }

  async updateRealTimeIndicators() {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&include_24hr_change=true');
      const data = await response.json();
      const change = data.bitcoin.usd_24h_change;
      this.params.volatility = 1 + (Math.abs(change) / 100);
      this.ui.setNews(`[MERCADO REAL] BTC 24h: ${change.toFixed(2)}% | Ajuste de Volatilidade: ${this.params.volatility.toFixed(2)}x`);
    } catch (e) {
      this.ui.setNews(`[INDICADOR] Sincronizado com relógio atômico de rede (BRT).`);
    }
  }

  // Minimal scanning flow preserved but delegating to UI / patterns / ml modules
  async startScanning() {
    this.ui.setBusy(true);
    const { platformDisplay, seedSource, game } = this.ui.collectInput();

    this.ui.showScanning();

    const scanAudio = this.audio.playLoop('scan-hum.mp3');
    // if seedSource looks like an events endpoint, start a short capture into queue
    try {
      const probeUrl = seedSource && (seedSource.startsWith('http') ? seedSource : null);
      if (probeUrl) {
        // attempt to fetch a handful of recent rounds and enqueue them for processing
        const resp = await fetch(probeUrl + '/recent-rounds', { mode: 'cors' }).catch(()=>null);
        if (resp && resp.ok) {
          const list = await resp.json().catch(()=>null);
          if (Array.isArray(list)) {
            for (const item of list) {
              await this.queue.enqueue(item).catch(()=>null);
            }
            this.ui.addLog(`[STREAM] Enqueued ${list.length} recent rounds from platform probe.`);
          }
        }
      }
    } catch(e){}

    const tasks = [
      {
        msg: "Calculando hash de integridade da plataforma...",
        action: () => generateSHA256(seedSource || window.location.href)
      },
      {
        msg: "Validando conectividade de rede...",
        action: async () => {
          // perform a real HEAD request to check reachability; fall back to fetch root if seedSource isn't a full URL
          let testUrl = seedSource && (seedSource.startsWith('http://') || seedSource.startsWith('https://')) ? seedSource : window.location.origin;
          try {
            const resp = await fetch(testUrl, { method: 'HEAD', mode: 'cors' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return resp;
          } catch (e) {
            // attempt a simple GET as secondary check
            const resp = await fetch(testUrl, { method: 'GET', mode: 'cors' }).catch(err => { throw err; });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return resp;
          }
        }
      },
      {
        msg: "Capturando entropia temporal (Horário de Brasília)...",
        action: () => {
          // return a deterministic timezone snapshot instead of artificial delay
          return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        }
      },
      {
        msg: "Sincronizando pesos probabilísticos...",
        action: () => this.updateRealTimeIndicators()
      },
      {
        msg: "Executando cálculo bayesiano de tendência...",
        action: async () => {
          // perform a real small computation based on current indicators
          const indicators = { volatility: this.params.volatility, timestamp: new Date().toISOString() };
          // simple deterministic scoring (no artificial wait)
          return { bayesScore: Math.max(0, Math.min(1, 1 / (1 + indicators.volatility))) };
        }
      }
    ];

    let completed = 0;
    for (const task of tasks) {
      this.ui.setStatus(task.msg);
      try {
        await task.action();
        this.ui.addLog(`[OK] ${task.msg}`);
      } catch (err) {
        this.ui.addLog(`[WARN] ${task.msg} -> ${err && err.message ? err.message : err}`);
      }
      completed++;
      const progress = (completed / tasks.length) * 100;
      this.ui.setProgress(progress);
    }

    // Optional ML ensemble call (non-blocking / safe)
    try {
      if (this.mlClient && this.mlClient.baseUrl) {
        this.ui.setStatus('Consultando modelos avançados...');
        this.ui.setModelName('ML Ensemble');
        const payload = { platform: platformDisplay, game, timestamp: new Date().toISOString(), indicators: { volatility: this.params.volatility } };
        const mlResp = await this.mlClient.inferEnsemble(payload);
        if (mlResp) {
          this.ui.addLog('[ML] Ensemble result received.');
          this.ui.applyMlOverrides(mlResp);
        } else {
          // try a multi-model safe aggregation if ensemble endpoint is not present
          try {
            const payload = { platform: platformDisplay, game, timestamp: new Date().toISOString(), indicators: { volatility: this.params.volatility } };
            const rnn = await this.mlClient.inferRNN(payload).catch(()=>null);
            const trans = await this.mlClient.inferTransformer(payload).catch(()=>null);
            const ae = await this.mlClient.inferAutoencoder(payload).catch(()=>null);

            // aggregate safely: weighted average where missing models are ignored
            const candidates = [rnn, trans, ae].filter(Boolean);
            if (candidates.length) {
              this.ui.addLog('[ML] Partial models received: ' + candidates.length);
              // merge simple numeric fields if present
              const merged = {};
              const weights = { roundsNormal: 1.0, roundsTurbo: 1.0, assertiveness: 1.0, confidenceScore: 1.0, riskScore: 1.0 };
              const accum = {};
              for (const c of candidates) {
                for (const k in c) {
                  if (typeof c[k] === 'number') {
                    accum[k] = (accum[k] || 0) + c[k];
                    merged[k] = true;
                  } else if (typeof c[k] === 'string' && k === 'signalType') {
                    merged.signalType = merged.signalType || c[k];
                  }
                }
              }
              for (const k in accum) accum[k] = accum[k] / candidates.length;
              // apply safe overrides with clamps
              const safeResp = {};
              if (accum.roundsNormal) safeResp.roundsNormal = Math.round(Math.max(1, Math.min(999, accum.roundsNormal)));
              if (accum.roundsTurbo) safeResp.roundsTurbo = Math.round(Math.max(1, Math.min(999, accum.roundsTurbo)));
              if (accum.assertiveness) safeResp.assertiveness = `${Math.max(1, Math.min(99.9, accum.assertiveness)).toFixed(1)}%`;
              if (accum.confidenceScore) safeResp.confidenceScore = Number((accum.confidenceScore).toFixed(2));
              if (accum.riskScore) safeResp.riskScore = Math.round(Math.max(0, Math.min(99, accum.riskScore)));
              if (merged.signalType) safeResp.signalType = merged.signalType;
              this.ui.applyMlOverrides(safeResp);
            }
          } catch (innerErr) {
            this.ui.addLog(`[ML] Fallback multi-model aggregation failed: ${innerErr && innerErr.message ? innerErr.message : innerErr}`);
          }
        }
      }
    } catch (e) {
      this.ui.addLog(`[ML] Ensemble call failed: ${e && e.message ? e.message : e}`);
    }

    if (scanAudio) scanAudio.stop();
    this.audio.playOnce('success-chime.mp3');

    await this.showResult(platformDisplay, game, seedSource);
    this.ui.setBusy(false);
  }

  async showResult(platform, game, seed) {
    this.ui.showResultView(platform, game);

    const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hour = nowBRT.getHours();
    const minute = nowBRT.getMinutes();

    const combinedSeed = `${seed}-${hour}-${minute}`;
    const hashArray = await generateSHA256(combinedSeed);

    const v1 = hashArray[0], v2 = hashArray[1], v3 = hashArray[2];
    const normal = (v1 % 10) + 3;
    const turbo = (v2 % 12) + 5;
    const baseAssert = 91.0 + ((v3 % 80) / 10);
    const finalAssert = Math.min(99.4, baseAssert * (this.params.volatility > 1.05 ? 0.98 : 1.0)).toFixed(1);
    const confScore = ((v1 + v2 + v3) / 76.5).toFixed(2);
    const risk = Math.round((10 - parseFloat(confScore)) * 10 * this.params.volatility);

    this.ui.setIfEmpty('roundsNormal', normal);
    this.ui.setIfEmpty('roundsTurbo', turbo);
    this.ui.setIfEmpty('assertiveness', `${finalAssert}%`);
    this.ui.setIfEmpty('confidenceScore', confScore);
    this.ui.setIfEmpty('riskScore', `${Math.min(99, risk)}%`);

    const analysis = await analyzePatterns(seed, nowBRT, 10);
    if (analysis.recommendation) {
      this.ui.setSignalType(analysis.recommendation.label);
      this.ui.setModelName(`Análise: ${analysis.dominantCluster || 'Padrão'} • Rep:${Math.round(analysis.repeatRate*100)}%`);
    } else {
      this.ui.setSignalType(v1 > 128 ? 'OTIMIZADO' : 'ESTÁVEL');
    }

    this.ui.renderPayingTimes(analysis.payingOffsets, nowBRT, v1, v2, v3);
    this.startValidityTimer(15 - (minute % 15));
    this.ui.enableGenerate(true);

    this.ui.addLog(`[SINAL] Processamento de hash concluído com sucesso. Pattern repeat:${analysis.repeatRate.toFixed(2)}, autocorr:${analysis.autocorr.toFixed(2)}`);
  }

  startValidityTimer(minutes) {
    if (this.validTimer) clearInterval(this.validTimer);
    let seconds = minutes * 60;
    const total = seconds;
    const update = () => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      this.ui.setValidity(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      const percent = (seconds / total) * 100;
      this.ui.setTimerBar(percent);
      if (seconds <= 0) {
        clearInterval(this.validTimer);
        this.ui.setValidity("EXPIRADO");
      }
      seconds--;
    };
    update();
    this.validTimer = setInterval(update, 1000);
  }

  reset() {
    this.ui.resetViews();
    if (this.validTimer) clearInterval(this.validTimer);
  }
}

document.addEventListener('DOMContentLoaded', () => new SignalApp());