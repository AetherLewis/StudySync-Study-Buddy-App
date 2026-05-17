const { Flashcard } = require("../models/models");
const { makeOllamaRequest } = require("../utils/ai/ollamaClient");
const {
  extractJson,
  getOllamaMessageContent,
} = require("../utils/ai/extractJson");
const {
  limitPromptSize,
  sanitizeString,
} = require("../utils/ai/promptLimiter");
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

const normalizeTags = (tags) => {
  if (!tags) {
    return [];
  }

  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const createFlashcard = async (userId, data) => {
  const { front, back, category = "General", tags = [] } = data;

  if (!front || !back) {
    throw new Error("Flashcard front and back text are required.");
  }

  const flashcard = new Flashcard({
    userId,
    front: String(front).trim(),
    back: String(back).trim(),
    category: String(category || "General").trim(),
    tags: normalizeTags(tags),
    dueDate: new Date(),
    interval: 1,
    easeFactor: DEFAULT_EASE,
    repetition: 0,
    reviewCount: 0,
    lastReviewed: null,
  });

  await flashcard.save();
  return flashcard;
};

const getFlashcards = async (userId, dueOnly = false) => {
  const filter = { userId };

  if (dueOnly) {
    filter.dueDate = { $lte: new Date() };
  }

  return await Flashcard.find(filter).sort({ dueDate: 1, createdAt: -1 });
};

const updateFlashcard = async (userId, flashcardId, updates) => {
  const validUpdates = {};

  if (updates.front !== undefined) {
    validUpdates.front = String(updates.front).trim();
  }
  if (updates.back !== undefined) {
    validUpdates.back = String(updates.back).trim();
  }
  if (updates.category !== undefined) {
    validUpdates.category = String(updates.category).trim();
  }
  if (updates.tags !== undefined) {
    validUpdates.tags = normalizeTags(updates.tags);
  }
  if (Object.keys(validUpdates).length === 0) {
    throw new Error("No valid fields provided for update.");
  }

  validUpdates.updatedAt = Date.now();

  const flashcard = await Flashcard.findOneAndUpdate(
    { _id: flashcardId, userId },
    validUpdates,
    { new: true },
  );

  if (!flashcard) {
    throw new Error("Flashcard not found or unauthorized.");
  }

  return flashcard;
};

const deleteFlashcard = async (userId, flashcardId) => {
  const flashcard = await Flashcard.findOneAndDelete({
    _id: flashcardId,
    userId,
  });

  if (!flashcard) {
    throw new Error("Flashcard not found or unauthorized.");
  }

  return flashcard;
};

const calculateSm2Schedule = (flashcard, quality) => {
  let easeFactor = flashcard.easeFactor || DEFAULT_EASE;
  let repetition = flashcard.repetition || 0;
  let interval = flashcard.interval || 1;

  if (quality < 3) {
    repetition = 0;
    interval = 1;
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
  } else {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(interval * easeFactor));
    }

    repetition += 1;
    easeFactor = Math.max(
      MIN_EASE,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    easeFactor,
    repetition,
    interval,
    reviewCount: (flashcard.reviewCount || 0) + 1,
    lastReviewed: new Date(),
    dueDate: nextReviewDate,
  };
};

const reviewFlashcard = async (userId, flashcardId, quality) => {
  if (typeof quality !== "number" || quality < 0 || quality > 5) {
    throw new Error("Quality must be a number between 0 and 5.");
  }

  const flashcard = await Flashcard.findOne({ _id: flashcardId, userId });
  if (!flashcard) {
    throw new Error("Flashcard not found or unauthorized.");
  }

  const schedule = calculateSm2Schedule(flashcard, quality);
  Object.assign(flashcard, schedule);

  await flashcard.save();
  return flashcard;
};

const validateGeneratedFlashcards = (payload) => {
  if (!payload || !Array.isArray(payload.flashcards)) {
    throw new Error(
      "AI response did not return flashcards in the expected format.",
    );
  }

  const cards = payload.flashcards
    .map((card) => ({
      front: card.front ? String(card.front).trim() : "",
      back: card.back ? String(card.back).trim() : "",
      category: card.category ? String(card.category).trim() : "General",
      tags: normalizeTags(card.tags || []),
    }))
    .filter((card) => card.front && card.back);

  if (!cards.length) {
    throw new Error("AI generated flashcards were empty or invalid.");
  }

  return cards;
};

const generateFlashcards = async (text, count = 3) => {
  if (!text || !String(text).trim()) {
    throw new Error("Study text is required for flashcard generation.");
  }

  const cardCount = Math.min(Math.max(Number(count) || 3, 1), 10);

  // Phase 2: Apply prompt limiting
  const limitedText = limitPromptSize(String(text).trim());

  const systemMessage = {
    role: "system",
    content:
      "You are a study assistant that creates concise flashcards from a provided study text. Output valid JSON only.",
  };

  const userMessage = {
    role: "user",
    content: `Generate ${cardCount} study flashcards from the text below. Respond ONLY with valid JSON in the following format:\n{\n  "flashcards": [\n    {"front": "...", "back": "...", "category": "...", "tags": ["..."]}\n  ]\n}\n\nText:\n"""${limitedText}"""`,
  };

  const response = await makeOllamaRequest([systemMessage, userMessage], {
    endpoint: "/api/chat",
  });

  const rawContent = getOllamaMessageContent(response);

  if (!rawContent) {
    throw new Error("No content returned from AI service.");
  }

  try {
    const parsed = extractJson(rawContent);
    return validateGeneratedFlashcards(parsed).slice(0, cardCount);
  } catch (error) {
    throw new Error("AI returned invalid JSON for flashcards.");
  }
};

module.exports = {
  createFlashcard,
  getFlashcards,
  updateFlashcard,
  deleteFlashcard,
  reviewFlashcard,
  generateFlashcards,
};
