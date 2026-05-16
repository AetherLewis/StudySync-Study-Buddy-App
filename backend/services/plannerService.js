const axios = require("axios");
const { Event } = require("../models/models");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";

const sanitizeString = (value) => (value ? String(value).trim() : "");

const extractJsonPayload = (text) => {
  const firstIndex = text.indexOf("{");
  const lastIndex = text.lastIndexOf("}");

  if (firstIndex === -1 || lastIndex === -1 || lastIndex <= firstIndex) {
    throw new Error("Unable to parse JSON from AI response.");
  }
  return text.slice(firstIndex, lastIndex + 1);
};

const normalizeEvent = (event) => {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("AI returned invalid event dates.");
  }

  return {
    title: sanitizeString(event.title) || "Study Session",
    description: sanitizeString(event.description) || "AI generated study session.",
    startDate,
    endDate,
    category: sanitizeString(event.category) || "Study",
    color: sanitizeString(event.color) || "#3949ab",
    allDay: Boolean(event.allDay),
  };
};

const validatePlanPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI response was not valid JSON.");
  }

  if (!Array.isArray(payload.events) || payload.events.length === 0) {
    throw new Error("AI response did not contain a study plan.");
  }

  const events = payload.events
    .map((event) => normalizeEvent(event))
    .filter((event) => event.title && event.startDate && event.endDate);

  if (events.length === 0) {
    throw new Error("AI did not provide any valid schedule events.");
  }

  return events;
};

const buildPlannerPrompt = ({ prompt, startDate, endDate, dailyHours }) => {
  const availableHours = Number(dailyHours) || 2;
  const requestedStart = sanitizeString(startDate) || "today";
  const requestedEnd = sanitizeString(endDate) || "one week from today";

  return `You are a strict study planner assistant. Create a personalized study schedule for the user based on the following goals and availability. Respond with valid JSON only, using this exact schema:\n{\n  "events": [\n    {\n      \"title\": \"...\",\n      \"description\": \"...\",\n      \"startDate\": \"YYYY-MM-DDTHH:mm:ssZ\",\n      \"endDate\": \"YYYY-MM-DDTHH:mm:ssZ\",\n      \"category\": \"...\",\n      \"color\": \"...\",\n      \"allDay\": false\n    }\n  ]\n}\n\nThe schedule should cover the date range from ${requestedStart} to ${requestedEnd}.\nUse study sessions of up to ${availableHours} hours per day.\nDo not include more than 3 sessions per day.\nKeep titles short and descriptive.\nUse ISO 8601 datetimes for startDate and endDate.\n\nUser goals and context:\n"""${sanitizeString(prompt)}"""\n\nReturn only valid JSON.`;
`;
};

const runPlanGeneration = async ({ prompt, startDate, endDate, dailyHours }) => {
  const fullPrompt = buildPlannerPrompt({ prompt, startDate, endDate, dailyHours });

  const response = await axios.post(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      model: OLLAMA_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a study planner assistant producing structured JSON output.",
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ],
      stream: false,
    },
    { timeout: 60000 },
  );

  const rawContent =
    response.data?.message?.content || response.data?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error("No content was returned from the AI service.");
  }

  const jsonText = extractJsonPayload(rawContent);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error("AI returned invalid JSON for study plan generation.");
  }
};

const generateStudyPlan = async (userId, requestBody) => {
  const { prompt, startDate, endDate, dailyHours } = requestBody;
  const cleanedPrompt = sanitizeString(prompt);

  if (!cleanedPrompt) {
    throw new Error("A study plan prompt is required.");
  }

  const planPayload = await runPlanGeneration({
    prompt: cleanedPrompt,
    startDate,
    endDate,
    dailyHours,
  });

  const events = validatePlanPayload(planPayload);

  const savedEvents = await Event.insertMany(
    events.map((event) => ({
      ...event,
      userId,
    })),
  );

  return savedEvents;
};

module.exports = {
  generateStudyPlan,
};
