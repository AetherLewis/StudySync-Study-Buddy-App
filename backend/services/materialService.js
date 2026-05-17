const { StudyMaterial } = require("../models/models");
const { makeOllamaRequest } = require("../utils/ai/ollamaClient");
const {
  extractJson,
  getOllamaMessageContent,
} = require("../utils/ai/extractJson");
const {
  limitPromptSize,
  sanitizeString,
} = require("../utils/ai/promptLimiter");

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

  const promptText = `You are a study assistant. Generate a concise and useful study material entry based on the user's prompt. Output valid JSON only using this schema:\n{\n  "title": "...",\n  "description": "...",\n  "category": "...",\n  "content": "...",\n  "tags": ["...", "..."]\n}\n${categoryHint}User prompt:\n"""${sanitizeString(prompt)}\"\"\"\nMake sure content is formatted for studying and includes at least one clear explanation or example. Use JSON and do not include additional text.`;

  // Phase 2: Apply prompt limiting
  return limitPromptSize(promptText);
};

const runMaterialGeneration = async ({ prompt, category }) => {
  const fullPrompt = buildMaterialPrompt({ prompt, category });

  const response = await makeOllamaRequest(
    [
      {
        role: "system",
        content:
          "You are a study material generator that outputs only valid JSON.",
      },
      {
        role: "user",
        content: fullPrompt,
      },
    ],
    { endpoint: "/api/chat" },
  );

  const rawContent = getOllamaMessageContent(response);

  if (!rawContent) {
    throw new Error("No content was returned from the AI service.");
  }

  try {
    return extractJson(rawContent);
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
