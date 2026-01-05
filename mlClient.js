/* mlClient.js
   Extracted MLServiceClient from app.js for modularity.
*/
export class MLServiceClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || '';
  }

  async infer(modelName, payload) {
    // Require a configured ML backend for real inference; fail fast if not present.
    if (!this.baseUrl) throw new Error('ML backend not configured. Set ML_BACKEND_URL to a real inference service.');
    const url = `${this.baseUrl}/infer/${encodeURIComponent(modelName)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`Inference failed: ${resp.status}`);
    return await resp.json();
  }

  async models() {
    if (!this.baseUrl) return [];
    const url = `${this.baseUrl}/models`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    return await resp.json();
  }

  async inferRNN(payload) { return this.infer('rnn-sequence', payload); }
  async inferTransformer(payload) { return this.infer('transformer-pattern', payload); }
  async inferAutoencoder(payload) { return this.infer('autoencoder-compress', payload); }
  async inferEnsemble(payload) { return this.infer('ensemble-voting', payload); }
  async inferRL(payload) { return this.infer('rl-decider', payload); }
  async runMonteCarlo(payload) { return this.infer('montecarlo-risk', payload); }
  async reduceDimensionality(payload) { return this.infer('dimensionality-pca-tsne', payload); }
}