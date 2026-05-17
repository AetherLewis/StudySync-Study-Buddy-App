// Centralized Ollama API client with retry logic and timeout handling
const axios = require("axios");
const { aiQueue } = require("./aiRequestQueue");
const { aiLogger } = require("./aiLogger");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";
const DEFAULT_TIMEOUT = parseInt(process.env.AI_REQUEST_TIMEOUT) || 180000; // 3 minutes
const MAX_RETRIES = 2;

const makeOllamaRequest = async (messages, options = {}) => {
  const {
    model = OLLAMA_MODEL,
    timeout = DEFAULT_TIMEOUT,
    endpoint = "/api/chat",
  } = options;

  const startTime = Date.now();
  let promptLength = 0;

  try {
    // Calculate total prompt length from messages
    promptLength = messages.reduce((sum, msg) => {
      return sum + (msg.content ? String(msg.content).length : 0);
    }, 0);

    let lastError;

    // Retry logic for transient failures
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await aiQueue.execute(async () => {
          return await axios.post(
            `${OLLAMA_BASE_URL}${endpoint}`,
            {
              model,
              messages,
              stream: false,
            },
            { timeout },
          );
        });

        const duration = Date.now() - startTime;
        aiLogger(endpoint, model, promptLength, duration, true);

        return response.data;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
          if (attempt < MAX_RETRIES) {
            console.warn(
              `[AI RETRY] Attempt ${attempt + 1}/${MAX_RETRIES + 1} - ${error.code}`,
            );
            // Exponential backoff: 500ms, 1000ms
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError;
  } catch (error) {
    const duration = Date.now() - startTime;
    aiLogger(endpoint, model, promptLength, duration, false, error);

    // Normalize error messages
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw new Error(
        `AI request timeout after ${duration}ms. Please try again.`,
      );
    }

    if (error.response?.status === 404) {
      throw new Error(`AI model not available: ${model}`);
    }

    if (error.message?.includes("ECONNREFUSED")) {
      throw new Error(
        "AI service is unavailable. Please try again in a moment.",
      );
    }

    throw new Error(`AI service error: ${error.message || "Unknown error"}`);
  }
};

module.exports = {
  makeOllamaRequest,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
  DEFAULT_TIMEOUT,
};
