const axios = require("axios");
const { StudyMaterial } = require("../models/models");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";

const sanitizeString = (value) => (value ? String(value).trim() : "");

const extractJsonPayload = (text) => {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Unable to parse JSON from AI response.");
  }

  return text.slice(first, last + 1);
};

const validateStudyMaterialPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI response was not valid JSON.");
  }

  const title = sanitizeString(payload.title);
  const description = sanitizeString(payload.description);
  const content = sanitizeString(payload.content);
  const category = sanitizeString(payload.category) || "General";
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((tag) => sanitizeString(tag)).filter(Boolean)
    : [];

  if (!title) {
    throw new Error("AI response did not provide a title for the material.");
  }

  if (!content) {
    throw new Error("AI response did not provide content for the material.");
  }

  return {
    title,
    description: description || "AI-generated study material",
    category,
    content,
    tags,
  };
};

const buildMaterialPrompt = ({ prompt, category }) => {
  const categoryHint = category
    ? `Preferred category: ${sanitizeString(category)}\n`
    : "";

  return `You are a study assistant. Generate a concise and useful study material entry based on the user's prompt. Output valid JSON only using this schema:\n{\n  \"title\": \"...\",\n  \"description\": \"...\",\n  \"category\": \"...\",\n  \"content\": \"...\",\n  \"tags\": [\"...\", \"...\"]\n}\n${categoryHint}User prompt:\n\"\"\"${sanitizeString(prompt)}\"\"\"\nMake sure content is formatted for studying and includes at least one clear explanation or example. Use JSON and do not include additional text.`;
};

const runMaterialGeneration = async ({ prompt, category }) => {
  const requestPayload = {
    model: OLLAMA_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a study material generator that outputs only valid JSON.",
      },
      {
        role: "user",
        content: buildMaterialPrompt({ prompt, category }),
      },
    ],
    stream: false,
  };

  const response = await axios.post(
    `${OLLAMA_BASE_URL}/api/chat`,
    requestPayload,
    { timeout: 60000 },
  );

  const rawContent =
    response.data?.message?.content ||
    response.data?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error("No content was returned from the AI service.");
  }

  const jsonText = extractJsonPayload(rawContent);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error("AI returned invalid JSON for study material generation.");
  }
};

const generateStudyMaterialFromPrompt = async (userId, requestBody) => {
  const { prompt, category } = requestBody;
  const cleanedPrompt = sanitizeString(prompt);

  if (!cleanedPrompt) {
    throw new Error("A prompt is required to generate study material.");
  }

  const aiPayload = await runMaterialGeneration({
    prompt: cleanedPrompt,
    category,
  });

  const validatedMaterial = validateStudyMaterialPayload(aiPayload);

  const material = new StudyMaterial({
    userId,
    title: validatedMaterial.title,
    description: validatedMaterial.description,
    category: validatedMaterial.category,
    content: validatedMaterial.content,
    tags: validatedMaterial.tags,
  });

  await material.save();
  return material;
};

const previewStudyMaterialFromPrompt = async (requestBody) => {
  const { prompt, category } = requestBody;
  const cleanedPrompt = sanitizeString(prompt);

  if (!cleanedPrompt) {
    throw new Error("A prompt is required to preview study material.");
  }

  const aiPayload = await runMaterialGeneration({
    prompt: cleanedPrompt,
    category,
  });

  return validateStudyMaterialPayload(aiPayload);
};

module.exports = {
  generateStudyMaterialFromPrompt,
  previewStudyMaterialFromPrompt,
};
