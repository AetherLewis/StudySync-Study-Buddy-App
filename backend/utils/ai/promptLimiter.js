// Centralized prompt truncation and sanitization
const MAX_PROMPT_LENGTH = parseInt(process.env.MAX_PROMPT_LENGTH) || 3000;

const sanitizeString = (value) => {
  if (!value) return "";
  return String(value).trim().replace(/\s+/g, " "); // collapse excessive whitespace
};

const limitPromptSize = (prompt) => {
  if (!prompt || typeof prompt !== "string") {
    return "";
  }

  const sanitized = sanitizeString(prompt);

  if (sanitized.length > MAX_PROMPT_LENGTH) {
    console.warn(
      `[AI PROMPT SIZE] Truncating prompt from ${sanitized.length} to ${MAX_PROMPT_LENGTH} chars`,
    );
    return sanitized.substring(0, MAX_PROMPT_LENGTH);
  }

  console.log(`[AI PROMPT SIZE] ${sanitized.length} chars`);
  return sanitized;
};

module.exports = { limitPromptSize, sanitizeString, MAX_PROMPT_LENGTH };
