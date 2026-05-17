// Lightweight AI request queue for concurrency control
class AIRequestQueue {
  constructor(maxConcurrent = 1) {
    this.maxConcurrent = maxConcurrent;
    this.activeRequests = 0;
    this.queue = [];
  }

  async execute(fn) {
    // If at capacity, queue the request
    while (this.activeRequests >= this.maxConcurrent) {
      await new Promise((resolve) => this.queue.push(resolve));
    }

    this.activeRequests++;

    try {
      return await fn();
    } finally {
      this.activeRequests--;

      // Process next queued request
      const resolve = this.queue.shift();
      if (resolve) {
        resolve();
      }
    }
  }

  getStatus() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      isBusy: this.activeRequests >= this.maxConcurrent,
    };
  }
}

// Global singleton instance
const aiQueue = new AIRequestQueue(1); // Start with 1 concurrent request max

module.exports = { AIRequestQueue, aiQueue };
