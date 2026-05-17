const { Quiz } = require("../models/models");
const { makeOllamaRequest } = require("../utils/ai/ollamaClient");
const {
  extractJson,
  getOllamaMessageContent,
} = require("../utils/ai/extractJson");
const {
  limitPromptSize,
  sanitizeString,
} = require("../utils/ai/promptLimiter");

// Phase 6: Reduce AI load - lower default quiz count
const DEFAULT_QUESTION_COUNT = 3;

const normalizeQuestion = (question) => {
  return {
    question: sanitizeString(question.question),

    options: Array.isArray(question.options)
      ? question.options.map(sanitizeString).filter(Boolean).slice(0, 4)
      : [],

    correctAnswer:
      typeof question.correctAnswer === "number"
        ? Math.max(0, Math.min(3, question.correctAnswer))
        : 0,

    explanation: sanitizeString(question.explanation || ""),
  };
};

const validateQuizPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI response was not valid JSON.");
  }

  const title = sanitizeString(payload.title);

  const category = sanitizeString(payload.category) || "General";

  const description =
    sanitizeString(payload.description) || "AI generated quiz";

  if (!title) {
    throw new Error("AI response did not provide a quiz title.");
  }

  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    throw new Error("AI response did not provide any quiz questions.");
  }

  const questions = payload.questions
    .map(normalizeQuestion)
    .filter(
      (question) =>
        question.question &&
        question.options.length === 4 &&
        Number.isInteger(question.correctAnswer),
    );

  if (questions.length === 0) {
    throw new Error("AI response produced invalid quiz questions.");
  }

  return {
    title,
    description,
    category,
    questions,
  };
};

const buildQuizPrompt = ({ text, topic, category, count }) => {
  const questionCount = Math.min(
    Math.max(Number(count) || DEFAULT_QUESTION_COUNT, 1),
    10,
  );

  const topicHint = sanitizeString(topic)
    ? `Topic: ${sanitizeString(topic)}\n`
    : "";

  const categoryHint = sanitizeString(category)
    ? `Preferred category: ${sanitizeString(category)}\n`
    : "";

  const prompt = `You are a rigorous educational assistant.

Generate ${questionCount} multiple-choice quiz questions from the following study text.

Respond with VALID JSON ONLY using this exact schema:

{
  "title": "...",
  "description": "...",
  "category": "...",
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": 0,
      "explanation": "..."
    }
  ]
}

${topicHint}${categoryHint}

Study text:
"""${sanitizeString(text)}"""

Rules:
- Return ONLY valid JSON
- Do not include markdown
- Do not include explanations outside JSON
- Each question must have exactly 4 options
- correctAnswer must be a number between 0 and 3
- Make questions educational and accurate`;

  // Apply prompt limiting to control size
  return limitPromptSize(prompt);
};

const runQuizGeneration = async ({ text, topic, category, count }) => {
  const prompt = buildQuizPrompt({
    text,
    topic,
    category,
    count,
  });

  const response = await makeOllamaRequest(
    [
      {
        role: "system",
        content:
          "You are a study assistant generating quizzes. Output valid JSON only.",
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
    console.error("Invalid AI JSON:", rawContent);
    throw new Error("AI returned invalid JSON for quiz generation.");
  }
};

const generateQuizFromText = async (userId, requestBody) => {
  const { text, topic, category, count } = requestBody;

  const studyText = sanitizeString(text);

  if (!studyText) {
    throw new Error("Study text is required to generate a quiz.");
  }

  const aiPayload = await runQuizGeneration({
    text: studyText,
    topic,
    category,
    count,
  });

  const quizData = validateQuizPayload(aiPayload);

  const quiz = new Quiz({
    userId,

    title: quizData.title,

    description: quizData.description,

    category: quizData.category,

    questions: quizData.questions,
  });

  await quiz.save();

  return quiz;
};

module.exports = {
  generateQuizFromText,
};
