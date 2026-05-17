// Structured AI request logging
const aiLogger = (
  endpoint,
  model,
  promptLength,
  duration,
  success,
  error = null,
) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    model,
    promptLength,
    duration,
    success,
    ...(error && { error: error.message || String(error) }),
  };

  if (success) {
    console.log("[AI SUCCESS]", JSON.stringify(logEntry));
  } else {
    console.error("[AI ERROR]", JSON.stringify(logEntry));
  }

  return logEntry;
};

module.exports = { aiLogger };
