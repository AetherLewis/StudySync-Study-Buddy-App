const {
  Goal,
  StudyMaterial,
  Quiz,
  Flashcard,
  StudySession,
} = require("../models/models");
const { makeOllamaRequest } = require("../utils/ai/ollamaClient");
const {
  extractJson,
  getOllamaMessageContent,
} = require("../utils/ai/extractJson");
const {
  limitPromptSize,
  sanitizeString,
} = require("../utils/ai/promptLimiter");

const validateResourceRecommendations = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI response was not valid JSON.");
  }

  const recommendations = Array.isArray(payload.recommendations)
    ? payload.recommendations
        .map((r) => ({
          title: sanitizeString(r.title) || "",
          description: sanitizeString(r.description) || "",
          url: sanitizeString(r.url) || "",
          category: sanitizeString(r.category) || "General",
          type: sanitizeString(r.type) || "Course",
          difficulty: sanitizeString(r.difficulty) || "Intermediate",
          reason: sanitizeString(r.reason) || "",
          estimatedTime: sanitizeString(r.estimatedTime) || "2-4 weeks",
          tags: Array.isArray(r.tags)
            ? r.tags.map((t) => sanitizeString(t)).filter(Boolean)
            : [],
        }))
        .filter((r) => r.title.length > 0 && r.url.length > 0)
    : [];

  if (recommendations.length === 0) {
    throw new Error(
      "AI response did not provide any resource recommendations.",
    );
  }

  return { recommendations };
};

const buildRecommendationPrompt = ({
  activeGoals,
  completedMaterials,
  recentTopics,
  proficiencyLevel,
}) => {
  const goalsText = activeGoals
    .map((g) => `- ${sanitizeString(g.title)} (${g.category})`)
    .join("\n");
  const materialsText = completedMaterials
    .slice(0, 3)
    .map((m) => `- ${sanitizeString(m.title)}`)
    .join("\n");
  const topicsText = recentTopics.slice(0, 3).join(", ");

  const promptText = `You are an expert learning resources curator. Based on the learner's current study goals, materials completed, and recent topics, recommend 3-5 high-quality online resources.

ACTIVE STUDY GOALS:
${goalsText || "None specified"}

MATERIALS COMPLETED:
${materialsText || "None yet"}

RECENT STUDY TOPICS:
${topicsText || "Not specified"}

PROFICIENCY LEVEL: ${sanitizeString(proficiencyLevel) || "Intermediate"}

Generate resource recommendations as valid JSON with this exact schema:
{
  "recommendations": [
    {
      "title": "...",
      "description": "...",
      "url": "https://...",
      "category": "...",
      "type": "Course|Book|Article|Video|Tool|Community",
      "difficulty": "Beginner|Intermediate|Advanced",
      "reason": "Why this resource is recommended...",
      "estimatedTime": "Time to complete (e.g., 2-4 weeks)",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Requirements:
- Include real, reputable resources (popular platforms like Coursera, edX, Khan Academy, etc.)
- Match resources to the learner's current goals and level
- Provide diverse resource types (courses, books, articles, tools)
- Ensure URLs are valid and realistic
- Give clear reasoning for each recommendation
- Return ONLY valid JSON, no additional text`;

  // Phase 2: Apply prompt limiting
  return limitPromptSize(promptText);
};

const runRecommendationGeneration = async ({
  activeGoals,
  completedMaterials,
  recentTopics,
  proficiencyLevel,
}) => {
  const prompt = buildRecommendationPrompt({
    activeGoals,
    completedMaterials,
    recentTopics,
    proficiencyLevel,
  });

  const response = await makeOllamaRequest(
    [
      {
        role: "system",
        content:
          "You are a learning resources curator that outputs only valid JSON.",
      },
      {
        role: "user",
        content: prompt,
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
    throw new Error("AI returned invalid JSON for resource recommendations.");
  }
};

const getRecommendations = async (userId) => {
  // Fetch user's active goals
  const activeGoals = await Goal.find({ userId, completed: false }).lean();

  // Fetch recently completed study materials
  const completedMaterials = await StudyMaterial.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  // Fetch recent study sessions to identify topics
  const recentSessions = await StudySession.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  // Extract topics from sessions and materials
  const recentTopics = [
    ...new Set([
      ...recentSessions.map((s) => s.subject).filter(Boolean),
      ...completedMaterials.map((m) => m.category).filter(Boolean),
    ]),
  ];

  // Determine proficiency level from quiz/flashcard performance
  const recentQuizzes = await Quiz.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  let proficiencyLevel = "Intermediate";
  if (recentQuizzes.length > 0) {
    const avgScore =
      recentQuizzes.reduce(
        (sum, q) => sum + ((q.score || 0) / (q.totalPoints || 100)) * 100,
        0,
      ) / recentQuizzes.length;
    if (avgScore > 80) proficiencyLevel = "Advanced";
    else if (avgScore < 50) proficiencyLevel = "Beginner";
  }

  // Generate recommendations
  const aiPayload = await runRecommendationGeneration({
    activeGoals,
    completedMaterials,
    recentTopics,
    proficiencyLevel,
  });

  return validateResourceRecommendations(aiPayload);
};

module.exports = {
  getRecommendations,
};
