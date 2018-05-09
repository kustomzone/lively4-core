import forge from 'node_modules/node-forge/dist/forge.min.js';

const C_MIN_MINING_DIFFICULTY = 1;
const C_MAX_MINING_DIFFICULTY = 60;

export default class MiningProof {
  constructor(miningDifficulty) {
    this.miningDifficulty = Math.max(C_MIN_MINING_DIFFICULTY,
                                     Math.min(C_MAX_MINING_DIFFICULTY, miningDifficulty));
    this.startTimestamp = null;
    this.finishTimestamp = null;
    this.hash = null;
  }
  
  async work() {
    this.startTimestamp = Date.now();
    await this._solveCryptoPuzzle();
    this.finishTimestamp = Date.now();
    this.hash = this._hash();
  }
  
  isFinalized() {
    return !!this.hash;
  }
  
  async _solveCryptoPuzzle() {
    // simulate proof of work by sleeping
    await new Promise(sleep => setTimeout(sleep, this.miningDifficulty * 1000));
  }
  
  _hash() {
    var sha256 = forge.md.sha256.create();
    return sha256.update(
      this.miningDifficulty +
      this.startTimestamp +
      this.finishTimestamp
    );
  }
}