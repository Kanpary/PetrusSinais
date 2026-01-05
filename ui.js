/* ui.js
   UI helper to encapsulate DOM operations and keep SignalApp lean.
   Tombstones: removed many DOM related methods from app.js (moved here).
   // removed DOM plumbing functions from app.js {}
*/
export class UI {
  constructor() {
    this.nodes = {
      setup: document.getElementById('setup-view'),
      scanning: document.getElementById('scanning-view'),
      result: document.getElementById('result-view'),
      startBtn: document.getElementById('start-btn'),
      generateBtn: document.getElementById('generate-again-btn'),
      resetBtn: document.getElementById('reset-btn'),
      platformInput: document.getElementById('platform-input'),
      gameSelect: document.getElementById('game-select'),
      scanPercentage: document.getElementById('scan-percentage'),
      scanProgressBar: document.getElementById('scan-progress-bar'),
      scanStatus: document.getElementById('scan-status'),
      modelName: document.getElementById('model-name'),
      logConsole: document.getElementById('log-console'),
      resPlatform: document.getElementById('result-platform-title'),
      resGame: document.getElementById('result-game-title'),
      roundsNormal: document.getElementById('rounds-normal'),
      roundsTurbo: document.getElementById('rounds-turbo'),
      assertiveness: document.getElementById('assertiveness'),
      payingTimes: document.getElementById('paying-times'),
      validUntil: document.getElementById('valid-until'),
      timerBar: document.getElementById('valid-timer-bar'),
      confidenceScore: document.getElementById('confidence-score'),
      riskScore: document.getElementById('risk-score'),
      signalType: document.getElementById('signal-type'),
      newsFeed: document.getElementById('news-feed-ticker')
    };
  }

  onStart(cb) { this.nodes.startBtn.addEventListener('click', cb); }
  onGenerate(cb) { if (this.nodes.generateBtn) this.nodes.generateBtn.addEventListener('click', cb); }
  onReset(cb) { this.nodes.resetBtn.addEventListener('click', cb); }

  collectInput() {
    const raw = this.nodes.platformInput.value.trim();
    let platformDisplay = 'Padrão', seedSource = 'default';
    if (raw) {
      try {
        const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
        platformDisplay = url.hostname.replace('www.', '').split('.')[0].toUpperCase();
        seedSource = url.hostname;
      } catch (e) {
        platformDisplay = raw.toUpperCase();
        seedSource = raw;
      }
    }
    const game = this.nodes.gameSelect.options[this.nodes.gameSelect.selectedIndex].text;
    return { platformDisplay, seedSource, game };
  }

  showScanning() {
    this.nodes.setup.classList.add('hidden');
    this.nodes.scanning.classList.remove('hidden');
  }
  showResultView(platform, game) {
    this.nodes.scanning.classList.add('hidden');
    this.nodes.result.classList.remove('hidden');
    this.nodes.resPlatform.innerText = platform;
    this.nodes.resGame.innerText = game;
  }

  setStatus(msg) { this.nodes.scanStatus.innerText = msg; }
  setModelName(name) { this.nodes.modelName.innerText = name; }
  addLog(msg) {
    const p = document.createElement('p');
    p.innerText = `> ${msg}`;
    this.nodes.logConsole.prepend(p);
    if (this.nodes.logConsole.children.length > 30) this.nodes.logConsole.removeChild(this.nodes.logConsole.lastChild);
  }
  setProgress(percent) {
    this.nodes.scanPercentage.innerText = `${Math.floor(percent)}%`;
    this.nodes.scanProgressBar.style.width = `${percent}%`;
  }
  setNews(msg) { this.nodes.newsFeed.innerText = msg; }
  setIfEmpty(id, value) {
    const map = {
      roundsNormal: this.nodes.roundsNormal,
      roundsTurbo: this.nodes.roundsTurbo,
      assertiveness: this.nodes.assertiveness,
      confidenceScore: this.nodes.confidenceScore,
      riskScore: this.nodes.riskScore
    };
    const el = map[id];
    if (el && (!el.innerText || el.innerText === '0' || el.innerText === '0%')) el.innerText = value;
  }
  setSignalType(val) { this.nodes.signalType.innerText = val; }
  setValidity(val) { this.nodes.validUntil.innerText = val; }
  setTimerBar(percent) { this.nodes.timerBar.style.width = `${percent}%`; }
  enableGenerate(enabled) { if (this.nodes.generateBtn) this.nodes.generateBtn.disabled = !enabled; this.nodes.startBtn.disabled = !enabled; }

  applyMlOverrides(mlResp) {
    if (typeof mlResp.roundsNormal === 'number') this.nodes.roundsNormal.innerText = mlResp.roundsNormal;
    if (typeof mlResp.roundsTurbo === 'number') this.nodes.roundsTurbo.innerText = mlResp.roundsTurbo;
    if (typeof mlResp.assertiveness === 'string') this.nodes.assertiveness.innerText = mlResp.assertiveness;
    if (typeof mlResp.confidenceScore !== 'undefined') this.nodes.confidenceScore.innerText = String(mlResp.confidenceScore);
    if (typeof mlResp.riskScore !== 'undefined') this.nodes.riskScore.innerText = `${mlResp.riskScore}%`;
    if (typeof mlResp.signalType === 'string') this.nodes.signalType.innerText = mlResp.signalType;
  }

  renderPayingTimes(payingOffsets, nowBRT, v1, v2, v3) {
    this.nodes.payingTimes.innerHTML = '';
    const cycleBase = 15;
    const minute = nowBRT.getMinutes();
    const nextCycleMinute = Math.ceil(minute / cycleBase) * cycleBase;
    const offsets = payingOffsets && payingOffsets.length ? payingOffsets : [v1 % 5, (v1+v2) % 5, (v2+v3) % 5];

    for (let i = 0; i < 3; i++) {
      const timeDate = new Date(nowBRT);
      timeDate.setMinutes(nextCycleMinute + (i * cycleBase) + offsets[i % offsets.length]);
      timeDate.setSeconds(0);
      const hh = timeDate.getHours().toString().padStart(2, '0');
      const mm = timeDate.getMinutes().toString().padStart(2, '0');
      const timeSpan = document.createElement('div');
      timeSpan.className = 'bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs font-mono font-bold border border-amber-500/30';
      timeSpan.innerText = `${hh}:${mm} (BRT)`;
      this.nodes.payingTimes.appendChild(timeSpan);
    }
  }

  resetViews() {
    this.nodes.result.classList.add('hidden');
    this.nodes.setup.classList.remove('hidden');
    this.nodes.scanPercentage.innerText = '0%';
    this.nodes.scanProgressBar.style.width = '0%';
    this.nodes.logConsole.innerHTML = '';
  }

  setBusy(isBusy) {
    this.enableGenerate(!isBusy);
  }
}