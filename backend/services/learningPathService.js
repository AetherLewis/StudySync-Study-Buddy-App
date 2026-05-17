const { Event } = require("../models/models");
const { makeOllamaRequest } = require("../utils/ai/ollamaClient");
const {
  extractJson,
  getOllamaMessageContent,
} = require("../utils/ai/extractJson");
const {
  limitPromptSize,
  sanitizeString,
} = require("../utils/ai/promptLimiter");

const validateLearningPathPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI response was not valid JSON.");
  }

  const title = sanitizeString(payload.title);
  const description = sanitizeString(payload.description);
  const estimatedDays = parseInt(payload.estimatedDays) || 30;
  const milestones = Array.isArray(payload.milestones)
    ? payload.milestones
        .map((m) => ({
          title: sanitizeString(m.title) || "",
          description: sanitizeString(m.description) || "",
          daysToComplete: parseInt(m.daysToComplete) || 7,
          resources: Array.isArray(m.resources)
            ? m.resources
                .map((r) => sanitizeString(r))
                .filter((r) => r.length > 0)
            : [],
        }))
        .filter((m) => m.title.length > 0)
    : [];

  if (!title) {
    throw new Error(
      "AI response did not provide a title for the learning path.",
    );
  }

  if (milestones.length === 0) {
    throw new Error("AI response did not provide any milestones.");
  }

  return {
    title,
    description: description || "AI-generated learning path",
    estimatedDays,
    milestones,
  };
};

const buildLearningPathPrompt = ({
  goalTitle,
  goalDescription,
  currentLevel,
  timeframe,
}) => {
  const promptText = `You are an expert learning path designer. Create a structured learning path for the following goal.

Goal Title: ${sanitizeString(goalTitle)}
Goal Description: ${sanitizeString(goalDescription)}
Current Level: ${sanitizeString(currentLevel) || "Beginner"}
Timeframe: ${sanitizeString(timeframe) || "30 days"}

Generate a detailed learning path as valid JSON with this exact schema:
{
  "title": "...",
  "description": "...",
  "estimatedDays": <number>,
  "milestones": [
    {
      "title": "...",
      "description": "...",
      "daysToComplete": <number>,
      "resources": ["resource 1", "resource 2", ...]
    }
  ]
}

Requirements:
- Break down the goal into 3-4 logical milestones
- Each milestone should have clear deliverables
- Suggest specific resources (books, courses, practices)
- Provide realistic day estimates for each milestone
- Make the path progressive and achievable
- Return ONLY valid JSON, no additional text`;

  // Phase 2: Apply prompt limiting
  return limitPromptSize(promptText);
};

const runLearningPathGeneration = async ({
  goalTitle,
  goalDescription,
  currentLevel,
  timeframe,
}) => {
  const prompt = buildLearningPathPrompt({
    goalTitle,
    goalDescription,
    currentLevel,
    timeframe,
  });

  const response = await makeOllamaRequest(
    [
      {
        role: "system",
        content:
          "You are a learning path generator that outputs only valid JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    { endpoint: "/api/chat" },
  );

  const rawContent =
    response?.message?.content || response?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error("No content was returned from the AI service.");
  }

  try {
    return extractJson(rawContent);
  } catch (error) {
    throw new Error("AI returned invalid JSON for learning path generation.");
  }
};

const previewLearningPath = async (requestBody) => {
  const { goalTitle, goalDescription, currentLevel, timeframe } = requestBody;

  if (!sanitizeString(goalTitle)) {
    throw new Error("Goal title is required to generate a learning path.");
  }

  const aiPayload = await runLearningPathGeneration({
    goalTitle,
    goalDescription,
    currentLevel,
    timeframe,
  });

  return validateLearningPathPayload(aiPayload);
};

const generateAndSaveLearningPath = async (userId, requestBody) => {
  const { goalTitle, goalDescription, currentLevel, timeframe } = requestBody;

  if (!sanitizeString(goalTitle)) {
    throw new Error("Goal title is required to generate a learning path.");
  }

  const aiPayload = await runLearningPathGeneration({
    goalTitle,
    goalDescription,
    currentLevel,
    timeframe,
  });

  const validatedPath = validateLearningPathPayload(aiPayload);
  const events = [];

  let currentDate = new Date();

  for (const milestone of validatedPath.milestones) {
    const endDate = new Date(currentDate);
    endDate.setDate(endDate.getDate() + milestone.daysToComplete);

    const event = new Event({
      userId,
      title: milestone.title,
      description: milestone.description,
      startDate: new Date(currentDate),
      endDate,
      category: "Learning Path Milestone",
      color: "primary",
      allDay: false,
      reminders: [
        { type: "email", minutesBefore: 1440 },
        { type: "notification", minutesBefore: 60 },
      ],
    });

    await event.save();
    events.push(event);
    currentDate = new Date(endDate);
  }

  return {
    path: validatedPath,
    events,
  };
};

module.exports = {
  previewLearningPath,
  generateAndSaveLearningPath,
};
