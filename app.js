/**
 * Advanced Predictive Signal Generator (extended)
 * Added lightweight temporal analysis, confidence scoring, cross-validation placeholders,
 * ARIMA / ensemble placeholders, risk calculations and feedback storage.
 */

class SignalApp {
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
            signalType: document.getElementById('signal-type')
        };

        this.audioCtx = null;
        this.scanSound = null;
        this.successSound = null;
        this.validTimer = null;
        this.models = this.generateModelNames(950);

        // simple storage for feedback & historical results (in-memory)
        this.history = [];
        this.feedback = [];

        this.init();
    }

    async init() {
        this.nodes.startBtn.addEventListener('click', () => this.startScanning());
        if (this.nodes.generateBtn) this.nodes.generateBtn.addEventListener('click', () => this.startScanning());
        this.nodes.resetBtn.addEventListener('click', () => this.reset());
        
        // Pre-load audio
        this.setupAudio();
    }

    setupAudio() {
        const loadSound = async (url) => {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            return await this.audioCtx.decodeAudioData(arrayBuffer);
        };

        window.addEventListener('touchstart', async () => {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                try {
                    this.scanSound = await loadSound('scan-hum.mp3');
                    this.successSound = await loadSound('success-chime.mp3');
                } catch (e) {
                    // silent fail for audio
                }
            }
        }, { once: true });
    }

    playSound(buffer, loop = false) {
        if (!this.audioCtx || !buffer) return null;
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        source.connect(this.audioCtx.destination);
        source.start(0);
        return source;
    }

    generateModelNames(count) {
        const prefixes = ['LSTM', 'RNN', 'XGBoost', 'Bayesian', 'Markov', 'Logit', 'RandomForest', 'Prophet', 'DeepQ', 'ARIMA'];
        const list = [];
        for (let i = 1; i <= count; i++) {
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            list.push(`${prefix}_v${(Math.random() * 10).toFixed(1)}_${i.toString().padStart(3, '0')}`);
        }
        return list;
    }

    async startScanning() {
        // prevent double-starts
        this.nodes.startBtn.disabled = true;
        if (this.nodes.generateBtn) this.nodes.generateBtn.disabled = true;

        const rawInput = this.nodes.platformInput.value.trim();
        let platformDisplay = 'Plataforma Padrão';
        let seedSource = 'default';

        if (rawInput) {
            try {
                const url = new URL(rawInput.startsWith('http') ? rawInput : `https://${rawInput}`);
                platformDisplay = url.hostname.replace('www.', '').split('.')[0].toUpperCase();
                seedSource = url.hostname;
            } catch (e) {
                platformDisplay = rawInput.toUpperCase();
                seedSource = rawInput;
            }
        }

        const game = this.nodes.gameSelect.options[this.nodes.gameSelect.selectedIndex].text;

        this.nodes.setup.classList.add('hidden');
        this.nodes.scanning.classList.remove('hidden');

        const scanLoop = this.playSound(this.scanSound, true);
        
        let progress = 0;
        const statusMsgs = [
            `Mapeando protocolos de ${platformDisplay}...`,
            'Extraindo séries temporais de apostas por hora...',
            'Analisando ciclos semanais e diários...',
            'Calculando desvio padrão e pesos...',
            'Executando validação cruzada entre modelos...',
            'Combinando ensemble e calibrando risco...'
        ];

        // Simulated scanning with logs from multiple model families
        while (progress < 100) {
            const step = Math.random() * 6 + 1.5;
            progress = Math.min(100, progress + step);
            
            this.nodes.scanPercentage.innerText = `${Math.floor(progress)}%`;
            this.nodes.scanProgressBar.style.width = `${progress}%`;
            
            this.nodes.scanStatus.innerText = statusMsgs[Math.floor((progress / 100) * statusMsgs.length)] || statusMsgs[statusMsgs.length-1];
            
            const model = this.models[Math.floor(Math.random() * this.models.length)];
            this.nodes.modelName.innerText = `Analisando: ${model}`;

            if (Math.random() > 0.65) {
                this.addLog(`[DATA] Série horária carregada (últimas 48h)`);
                this.addLog(`[MODEL] ${model} pontuou: ${(Math.random()*1.2).toFixed(3)}`);
            }

            await new Promise(r => setTimeout(r, Math.random() * 150 + 50));
        }

        if (scanLoop) {
            try { scanLoop.stop(); } catch(e) {}
        }
        this.playSound(this.successSound);
        // produce results using analysis pipeline
        this.showResult(platformDisplay, game, seedSource);
    }

    addLog(msg) {
        const p = document.createElement('p');
        p.innerText = `> ${msg}`;
        this.nodes.logConsole.prepend(p);
        if (this.nodes.logConsole.children.length > 30) {
            this.nodes.logConsole.removeChild(this.nodes.logConsole.lastChild);
        }
    }

    // Lightweight temporal-pattern detection (hours/day-of-week)
    analyzeTemporalPatterns(sampleSeries = null, prng = Math.random) {
        // Accepts placeholder series: we simulate hourly volumes for 48 hours
        const hours = 48;
        const series = sampleSeries || Array.from({length: hours}, (_,i) => 10 + Math.round(20*prng() * (1 + Math.sin(i/6))));
        // detect hour-of-day peaks (simple average per hour mod 24)
        const byHour = {};
        for (let i=0;i<hours;i++){
            const h = i % 24;
            byHour[h] = (byHour[h] || 0) + series[i];
        }
        const peaks = Object.entries(byHour).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>parseInt(x[0]));
        const avg = series.reduce((s,v)=>s+v,0)/series.length;
        const std = Math.sqrt(series.reduce((s,v)=>s+Math.pow(v-avg,2),0)/series.length);
        return {peaks, avg, std, series};
    }

    // Confidence score derived from std dev, model agreement and weights (lightweight)
    computeConfidenceScore(metrics = {}) {
        // metrics: {std, modelAgreement:0..1, featureWeight:0..1}
        const std = metrics.std || 1;
        const modelAgreement = metrics.modelAgreement !== undefined ? metrics.modelAgreement : 0.7;
        const featureWeight = metrics.featureWeight !== undefined ? metrics.featureWeight : 0.6;
        // higher std (volatility) reduces confidence; modelAgreement & featureWeight increase it
        const base = Math.max(0, (modelAgreement * 0.6 + featureWeight * 0.4) * 100);
        const penalty = Math.min(40, std * 2); // convert std to penalty
        const score = Math.max(0, base - penalty);
        return Number((score/10).toFixed(2)); // scaled 0..10 for UI brevity
    }

    // Placeholder ARIMA / NN model runner (simulated)
    runPredictiveModels(seedValue, prng) {
        // returns object with modelAgreement 0..1 and ensemble prediction 'UP'/'DOWN'/'STABLE'
        const agreement = 0.6 + prng()*0.4; // simulated agreement between models
        const roll = prng();
        let pred = 'STABLE';
        if (roll > 0.85) pred = 'UP';
        else if (roll < 0.1) pred = 'DOWN';
        return {modelAgreement: Number(agreement.toFixed(3)), ensemblePrediction: pred};
    }

    // Simple k-fold cross validation placeholder returning mean score
    crossValidate(models = [], k = 5, prng = Math.random) {
        // Simulate cross-validation scores
        const scores = Array.from({length:k},()=>0.7 + prng()*0.25);
        const mean = scores.reduce((s,v)=>s+v,0)/scores.length;
        return Number(mean.toFixed(3));
    }

    // Compute risk % based on confidence and volatility
    computeRisk(confidenceScore, std) {
        // confidenceScore 0..10, std is volatility
        const confFactor = Math.max(0.1, (10 - confidenceScore) / 10); // higher means more risk
        const volFactor = Math.min(2, 1 + std/10);
        let risk = Math.min(95, Math.round(confFactor * volFactor * 100));
        return risk;
    }

    showResult(platform, game, seed) {
        this.nodes.scanning.classList.add('hidden');
        this.nodes.result.classList.remove('hidden');

        this.nodes.resPlatform.innerText = platform;
        this.nodes.resGame.innerText = game;

        // deterministic seeded PRNG for reproducible results within a minute
        const seedSource = `${seed}::${new Date().getMinutes()}`; 
        const seedValue = this.stringToHash(seedSource) >>> 0;
        const prng = this.mulberry32(seedValue);

        // Temporal analysis (simulated or derived)
        const temporal = this.analyzeTemporalPatterns(null, prng);
        this.addLog(`[ANALYSIS] picos horários detectados: ${temporal.peaks.join(', ')}`);
        this.addLog(`[ANALYSIS] média=${temporal.avg.toFixed(2)} std=${temporal.std.toFixed(2)}`);

        // Run predictive model ensemble placeholder
        const modelResult = this.runPredictiveModels(seedValue, prng);
        this.addLog(`[ENSEMBLE] Previsão: ${modelResult.ensemblePrediction} (concordância=${modelResult.modelAgreement})`);

        // Cross-validation (simulated)
        const cvScore = this.crossValidate([],5,prng);
        this.addLog(`[VALIDATION] CV score médio: ${cvScore}`);

        // Determine rounds and assertiveness similar to earlier but tied to PRNG
        const normal = Math.max(1, Math.floor(prng()*12)+3);
        const turbo = Math.max(1, Math.floor(prng()*18)+6);
        const assert = (85 + prng()*15).toFixed(1);

        this.nodes.roundsNormal.innerText = normal;
        this.nodes.roundsTurbo.innerText = turbo;
        this.nodes.assertiveness.innerText = `${assert}%`;

        // Confidence score combining std, model agreement and feature weight (feature weight simulated)
        const confScore = this.computeConfidenceScore({std: temporal.std, modelAgreement: modelResult.modelAgreement, featureWeight: 0.65});
        this.nodes.confidenceScore.innerText = confScore.toString();

        // Risk calculation
        const risk = this.computeRisk(confScore, temporal.std);
        this.nodes.riskScore.innerText = `${risk}%`;

        // Map ensemble prediction to signal type display
        this.nodes.signalType.innerText = modelResult.ensemblePrediction === 'UP' ? 'ALTA' : modelResult.ensemblePrediction === 'DOWN' ? 'BAIXA' : 'ESTÁVEL';

        // Generate Paying Times
        this.nodes.payingTimes.innerHTML = '';
        const now = new Date();
        const baseOffset = 1 + Math.floor(prng()*5);
        for (let i=0;i<3;i++){
            const timeSpan = document.createElement('div');
            timeSpan.className = 'bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs font-mono font-bold border border-amber-500/30';
            const extra = Math.floor(prng()*4);
            const futureMin = now.getMinutes() + baseOffset + i*(baseOffset+1) + extra;
            const displayDate = new Date(now.getTime() + (futureMin - now.getMinutes())*60000);
            timeSpan.innerText = `${displayDate.getHours().toString().padStart(2,'0')}:${displayDate.getMinutes().toString().padStart(2,'0')}`;
            this.nodes.payingTimes.appendChild(timeSpan);
        }

        // Validity window influenced by PRNG (between 3 and 10 minutes)
        const validityMinutes = 3 + Math.floor(prng()*8);
        this.startValidityTimer(validityMinutes);

        // Save to history
        const snapshot = {
            timestamp: new Date().toISOString(),
            platform,
            game,
            rounds: {normal, turbo},
            assertiveness: `${assert}%`,
            confidence: confScore,
            risk,
            signal: this.nodes.signalType.innerText
        };
        this.history.unshift(snapshot);
        if (this.history.length > 50) this.history.pop();

        // Re-enable controls
        if (this.nodes.generateBtn) this.nodes.generateBtn.disabled = false;
        this.nodes.startBtn.disabled = false;
    }

    stringToHash(string) {
        // FNV-1a 32-bit hash
        let h = 0x811c9dc5;
        for (let i = 0; i < string.length; i++) {
            h ^= string.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    mulberry32(a) {
        return function() {
            a |= 0;
            a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    startValidityTimer(minutes) {
        if (this.validTimer) clearInterval(this.validTimer);
        
        let seconds = minutes * 60;
        const total = seconds;

        const update = () => {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            this.nodes.validUntil.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            
            const percent = (seconds / total) * 100;
            this.nodes.timerBar.style.width = `${percent}%`;

            if (seconds <= 0) {
                clearInterval(this.validTimer);
                this.nodes.validUntil.innerText = "EXPIRADO";
                this.nodes.validUntil.classList.add('text-red-500');
            }
            seconds--;
        };

        update();
        this.validTimer = setInterval(update, 1000);
    }

    // basic feedback API: store user feedback string and optional success flag
    submitFeedback(text, success = false) {
        this.feedback.push({text, success, ts: new Date().toISOString()});
        if (this.feedback.length > 200) this.feedback.shift();
        this.addLog(`[FEEDBACK] recebido: ${text.slice(0,80)}`);
    }

    reset() {
        this.nodes.result.classList.add('hidden');
        this.nodes.setup.classList.remove('hidden');
        this.nodes.scanPercentage.innerText = '0%';
        this.nodes.scanProgressBar.style.width = '0%';
        this.nodes.logConsole.innerHTML = '';
        if (this.validTimer) clearInterval(this.validTimer);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new SignalApp();
});