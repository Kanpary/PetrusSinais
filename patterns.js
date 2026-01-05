/* patterns.js
   Forensic and audit-focused pattern analysis helpers for RNG / sequence diagnostics.
   NOTE: These utilities are intended for ethical auditing, testing, and research — NOT for evading
   or exploiting gambling systems. Use responsibly and within legal boundaries.
*/

export async function generateSHA256(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer));
}

/* Frequency analysis: absolute and relative frequencies */
export function frequencyAnalysis(sequence) {
  const freq = {};
  for (const s of sequence) freq[s] = (freq[s] || 0) + 1;
  const total = sequence.length || 1;
  const rel = {};
  for (const k in freq) rel[k] = freq[k] / total;
  return { absolute: freq, relative: rel, total };
}

/* Conditional probabilities P(next | current) for symbol pairs */
export function conditionalProbabilities(sequence) {
  const counts = {};
  const totals = {};
  for (let i = 0; i < sequence.length - 1; i++) {
    const cur = sequence[i], next = sequence[i + 1];
    counts[cur] = counts[cur] || {};
    counts[cur][next] = (counts[cur][next] || 0) + 1;
    totals[cur] = (totals[cur] || 0) + 1;
  }
  const cond = {};
  for (const cur in counts) {
    cond[cur] = {};
    for (const next in counts[cur]) {
      cond[cur][next] = counts[cur][next] / (totals[cur] || 1);
    }
  }
  return cond;
}

/* Markov predictor (order-1) */
export function markovPredict(sequence, currentSymbol, topK = 3) {
  const cond = conditionalProbabilities(sequence);
  const map = cond[String(currentSymbol)] || {};
  const entries = Object.keys(map).map(k => ({ symbol: Number(k), prob: map[k] }));
  entries.sort((a, b) => b.prob - a.prob);
  return entries.slice(0, topK);
}

/* Smoothing filter */
export function smoothSequence(sequence, alpha = 0.3) {
  if (!sequence || !sequence.length) return [];
  const out = [sequence[0]];
  for (let i = 1; i < sequence.length; i++) {
    out[i] = alpha * sequence[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

/* Outlier detection using IQR */
export function detectOutliers(sequence) {
  const nums = sequence.slice().sort((a,b)=>a-b);
  const q = (arr, p) => {
    const idx = (arr.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return arr[lo];
    return arr[lo] * (hi - idx) + arr[hi] * (idx - lo);
  };
  const q1 = q(nums, 0.25), q3 = q(nums, 0.75), iqr = q3 - q1 || 1;
  const lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
  const outliers = [];
  sequence.forEach((v, i) => { if (v < lower || v > upper) outliers.push({ index: i, value: v }); });
  return { q1, q3, iqr, lower, upper, outliers };
}

/* Kolmogorov-Smirnov two-sample test (returns D statistic and approximate p-value via asymptotic formula)
   Works on numeric arrays. Lightweight approximation for audit use.
*/
export function ksTwoSample(a, b) {
  if (!a.length || !b.length) return { D: 0, p: 1 };
  const sa = a.slice().sort((x,y)=>x-y), sb = b.slice().sort((x,y)=>x-y);
  let i=0,j=0, ca=0, cb=0, D=0;
  while (i<sa.length && j<sb.length) {
    if (sa[i] <= sb[j]) { ca++; i++; } else { cb++; j++; }
    const fa = ca/sa.length, fb = cb/sb.length;
    D = Math.max(D, Math.abs(fa-fb));
  }
  // finish tails
  while (i<sa.length) { ca++; i++; D = Math.max(D, Math.abs((ca/sa.length)-(cb/sb.length))); }
  while (j<sb.length) { cb++; j++; D = Math.max(D, Math.abs((ca/sa.length)-(cb/sb.length))); }
  // approximate p-value (Smirnov) for large n
  const n = (sa.length * sb.length) / (sa.length + sb.length);
  const lambda = (Math.sqrt(n) + 0.12 + 0.11/Math.sqrt(n)) * D;
  // Use asymptotic Kolmogorov distribution approximation
  const p = 2 * (Math.exp(-2 * lambda * lambda));
  return { D, p: Math.min(1, Math.max(0, p)) };
}

/* Runs test for randomness on binary sequence (or transform numeric to below/above median) */
export function runsTest(sequence) {
  if (!sequence.length) return { z: 0, p: 1 };
  const median = sequence.slice().sort((a,b)=>a-b)[Math.floor(sequence.length/2)];
  const bin = sequence.map(v => v > median ? 1 : 0);
  const n1 = bin.filter(x=>x===1).length, n0 = bin.length - n1;
  if (n0 === 0 || n1 === 0) return { z: 0, p: 1 };
  // count runs
  let runs = 1;
  for (let i=1;i<bin.length;i++) if (bin[i] !== bin[i-1]) runs++;
  const expected = ((2*n0*n1)/(n0+n1)) + 1;
  const variance = (2*n0*n1*(2*n0*n1 - n0 - n1))/((n0+n1)**2 * (n0+n1-1));
  const z = (runs - expected) / Math.sqrt(variance || 1);
  // two-tailed p-value approx
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { runs, expected, variance, z, p };
}

/* Cross-correlation for two numeric sequences (lag range) */
export function crossCorrelation(x, y, maxLag = 10) {
  const mx = mean(x), my = mean(y);
  const sx = std(x), sy = std(y);
  const lags = {};
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let sum = 0, count = 0;
    for (let i = 0; i < x.length; i++) {
      const j = i + lag;
      if (j < 0 || j >= y.length) continue;
      sum += (x[i]-mx)*(y[j]-my);
      count++;
    }
    lags[lag] = count ? (sum / (count * sx * sy)) : 0;
  }
  return lags;
}

/* Lightweight k-means clustering for small numeric vectors (Euclidean) - for exploratory analysis */
export function kmeans(data, k = 2, maxIter = 50) {
  if (!data.length || k <= 0) return { centers: [], labels: [] };
  // data: array of numeric (or array of arrays). Support 1D numeric for simplicity.
  const flat = data.map(d => (Array.isArray(d) ? d.slice() : [d]));
  const dims = flat[0].length;
  const centers = [];
  // init centers deterministically using first k distinct points (no randomness)
  for (let i = 0; i < Math.min(k, flat.length); i++) {
    centers.push(flat[i].slice());
  }
  let labels = new Array(flat.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    // assignment
    for (let i=0;i<flat.length;i++) {
      let best = 0, bestD = distSq(flat[i], centers[0]);
      for (let c=1;c<centers.length;c++) {
        const d = distSq(flat[i], centers[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true; }
    }
    if (!changed) break;
    // update centers
    const sums = centers.map(() => new Array(dims).fill(0));
    const counts = centers.map(() => 0);
    for (let i=0;i<flat.length;i++) {
      const c = labels[i];
      counts[c]++;
      for (let d=0; d<dims; d++) sums[c][d] += flat[i][d];
    }
    for (let c=0;c<centers.length;c++) {
      if (counts[c] === 0) continue;
      for (let d=0; d<dims; d++) centers[c][d] = sums[c][d] / counts[c];
    }
  }
  return { centers, labels };
}

/* Helper math functions */
function mean(arr) { if (!arr.length) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }
function std(arr) { const m = mean(arr); return Math.sqrt(arr.reduce((s,v)=>s+(v-m)*(v-m),0)/Math.max(1,arr.length-1)); }
function distSq(a,b) { let s=0; for (let i=0;i<a.length;i++) s += (a[i]-b[i])*(a[i]-b[i]); return s; }
function normalCdf(z) { // approx
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp(-z*z/2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - p;
}

/* Forensic pattern analyzer that composes the above utilities for a diagnostic report.
   Returns metrics useful for auditing RNG behavior: freq, ks vs uniform, runs test, autocorr, clusters.
*/
export async function analyzePatterns(seed, nowDate, lookbackMinutes = 8) {
  // Build deterministic sequence same as before (0-9 codes)
  const seq = [];
  for (let i = 0; i < lookbackMinutes; i++) {
    const d = new Date(nowDate);
    d.setMinutes(d.getMinutes() - i);
    const key = `${seed}-${d.getHours()}-${d.getMinutes()}`;
    try {
      const h = await generateSHA256(key);
      seq.push(h[0] % 10);
    } catch (e) {
      seq.push((i + 3) % 10);
    }
  }
  seq.reverse();

  const freq = frequencyAnalysis(seq);
  const cond = conditionalProbabilities(seq);

  // compare to uniform distribution via KS (transform symbols to numeric [0,1])
  const observed = seq.map(v => (v + Math.random()*0) / 9); // normalized 0..1
  const uniform = Array.from({length: observed.length}, (_,i)=> (i + 0.5)/observed.length);
  const ks = ksTwoSample(observed, uniform);

  const runs = runsTest(seq);

  // autocorrelation lag-1
  const meanSeq = mean(seq);
  let cov = 0, varr = 0;
  for (let i = 1; i < seq.length; i++) cov += (seq[i]-meanSeq)*(seq[i-1]-meanSeq);
  for (let i = 0; i < seq.length; i++) varr += (seq[i]-meanSeq)*(seq[i]-meanSeq);
  const autocorr = Math.abs(varr) < 1e-8 ? 0 : (cov / Math.max(1, seq.length-1)) / (varr/Math.max(1, seq.length));

  // cluster analysis (exploratory)
  const km = kmeans(seq, Math.min(3, Math.max(2, Math.floor(seq.length/3) || 2)));

  // detect repeats
  const repeats = seq.reduce((acc, v, i) => i && seq[i - 1] === v ? acc + 1 : acc, 0);
  const repeatRate = repeats / Math.max(1, seq.length - 1);

  // construct lightweight report
  return {
    sequence: seq,
    frequency: freq,
    conditional: cond,
    ksTest: ks,
    runsTest: runs,
    autocorr,
    cluster: km,
    repeatRate,
    payingOffsets: [
      (freq.total ? Math.max(...Object.keys(freq.absolute).map(Number)) % 6 : 0),
      1, 2
    ],
    recommendation: { label: 'AUDIT', advice: 'Use these metrics for forensic analysis; not for exploitation.' }
  };
}

/* Ethical notice:
   These tools are provided for auditing, research, and testing RNG fairness and behavior.
   They must not be used to attempt to bypass, cheat, or manipulate live gambling platforms.
*/