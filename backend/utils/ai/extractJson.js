// Safe JSON parsing and extraction from malformed AI responses
const safeJsonParse = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
};

const extractJson = (text) => {
  if (!text || typeof text !== "string") {
    throw new Error("Input text must be a non-empty string");
  }

  const trimmed = text.trim();
  const startsWithObject = trimmed.startsWith("{");
  const startsWithArray = trimmed.startsWith("[");

  if (startsWithObject || startsWithArray) {
    return safeJsonParse(trimmed);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");

  let extracted = "";

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    extracted = trimmed.slice(firstBrace, lastBrace + 1);
  } else if (
    firstBracket !== -1 &&
    lastBracket !== -1 &&
    lastBracket > firstBracket
  ) {
    extracted = trimmed.slice(firstBracket, lastBracket + 1);
  }

  if (!extracted) {
    throw new Error("Unable to locate valid JSON in AI response");
  }

  return safeJsonParse(extracted);
};

const getOllamaMessageContent = (response) => {
  const payload = response?.data ?? response;

  const content =
    payload?.message?.content ||
    payload?.choices?.[0]?.message?.content ||
    payload?.choices?.[0]?.content ||
    "";

  if (!content || typeof content !== "string") {
    return "";
  }

  return content;
};

module.exports = { safeJsonParse, extractJson, getOllamaMessageContent };
