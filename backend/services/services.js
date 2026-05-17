const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const { User, Group } = require("../models/models");
const { makeOllamaRequest } = require("../utils/ai/ollamaClient");
const { limitPromptSize } = require("../utils/ai/promptLimiter");
const { getOllamaMessageContent } = require("../utils/ai/extractJson");
require("dotenv").config();

// ─── Spotify Token Cache ─────────────────────────────────────────────────────
let spotifyAccessToken = null;
let spotifyTokenExpiry = null;

// ─── Spotify ─────────────────────────────────────────────────────────────────
const getSpotifyAccessToken = async () => {
  if (spotifyAccessToken && spotifyTokenExpiry > Date.now()) {
    return spotifyAccessToken;
  }

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
          ).toString("base64")}`,
        },
      },
    );

    spotifyAccessToken = response.data.access_token;
    spotifyTokenExpiry = Date.now() + response.data.expires_in * 1000;

    return spotifyAccessToken;
  } catch (error) {
    console.error(
      "Error retrieving Spotify access token:",
      error.message,
      error.response?.data || "",
    );
    throw new Error("Failed to retrieve Spotify access token");
  }
};

// Music recommendation service
const getMusicRecommendation = async (searchTerm = "study") => {
  try {
    const accessToken = await getSpotifyAccessToken();

    const response = await axios.get("https://api.spotify.com/v1/search", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: searchTerm,
        type: "track",
        limit: 10,
      },
    });

    return response.data.tracks.items.map((track) => ({
      name: track.name,
      artist: track.artists[0]?.name,
      preview_url: track.preview_url,
      spotify_url: track.external_urls.spotify,
      image_url: track.album.images[0]?.url,
    }));
  } catch (error) {
    console.error(
      "Error fetching music search results:",
      error.message,
      error.response?.data || "",
    );
    return [];
  }
};

// ─── User Services ────────────────────────────────────────────────────────────
const registerUser = async (userData) => {
  const {
    name,
    email,
    password,
    interests = [],
    availableTimes = [],
    courses = [],
  } = userData;

  if (!name || !email || !password) {
    throw new Error("Name, email, and password are required.");
  }

  try {
    const user = new User({
      name,
      email,
      password,
      interests,
      availableTimes,
      courses,
    });

    await user.save();

    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "72h",
    });
  } catch (error) {
    console.error("Error registering user:", error.message);
    throw new Error("User registration failed");
  }
};

const loginUser = async (email, password) => {
  try {
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.password !== password) {
      throw new Error("Invalid credentials");
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return token;
  } catch (error) {
    console.error("Error logging in user:", error.message);
    throw new Error("Login failed");
  }
};

const getUserProfile = async (userId) => {
  try {
    return await User.findById(userId);
  } catch (error) {
    console.error("Error retrieving user profile:", error.message);
    throw new Error("Failed to retrieve user profile");
  }
};

const updateUserProfile = async (userId, updateData) => {
  try {
    return await User.findByIdAndUpdate(userId, updateData, { new: true });
  } catch (error) {
    console.error("Error updating user profile:", error.message);
    throw new Error("Failed to update profile");
  }
};

const searchUserProfiles = async (query) => {
  try {
    return await User.find({ name: new RegExp(query, "i") });
  } catch (error) {
    console.error("Error searching user profiles:", error.message);
    throw new Error("Failed to search user profiles");
  }
};

// ─── Group and Session Services ───────────────────────────────────────────────
const createGroup = async (members, course) => {
  try {
    const group = new Group({ members, course });
    await group.save();
    return group;
  } catch (error) {
    console.error("Error creating group:", error.message);
    throw new Error("Failed to create group");
  }
};

const createStudySession = async (groupId, date, musicMood) => {
  try {
    const group = await Group.findById(groupId);
    group.studySessions.push({ date, musicMood });
    await group.save();
    return group;
  } catch (error) {
    console.error("Error creating study session:", error.message);
    throw new Error("Failed to create study session");
  }
};

// ─── AI Chat Service (Ollama) ─────────────────────────────────────────────────
let sessionHistory = {};

const chatWithAI = async (sessionId, message, originalText = "") => {
  if (!sessionHistory[sessionId]) {
    sessionHistory[sessionId] = [];
  }

  const history = sessionHistory[sessionId];

  // Phase 2: Apply prompt limiting to user messages
  const limitedMessage = limitPromptSize(message);
  const limitedOriginal = originalText ? limitPromptSize(originalText) : "";

  // Add opening context message if this is the first message in the session
  if (history.length === 0 && limitedOriginal) {
    history.push({ role: "user", content: limitedOriginal });
  }

  history.push({ role: "user", content: limitedMessage });

  // Build messages array with system instruction prepended
  const messages = [
    {
      role: "system",
      content: `${process.env.AI_INSTRUCTIONS || "You are a helpful study assistant."}. Respond to the user conversationally.`,
    },
    ...history,
  ];

  try {
    const response = await makeOllamaRequest(messages, {
      endpoint: "/api/chat",
    });

    const responseText = getOllamaMessageContent(response);

    if (!responseText) {
      throw new Error("Empty response from Ollama");
    }

    // Save assistant reply to history
    history.push({ role: "assistant", content: responseText });
    sessionHistory[sessionId] = history;

    return responseText;
  } catch (error) {
    console.error("Error in AI chat with Ollama:", error.message);
    throw new Error("AI chat failed. Make sure the Ollama server is running.");
  }
};

const clearSessionHistory = (sessionId) => {
  try {
    delete sessionHistory[sessionId];
  } catch (error) {
    console.error("Error clearing session history:", error.message);
  }
};

// ─── Weather Service ──────────────────────────────────────────────────────────
const getWeather = async (city) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!city) {
      throw new Error("City name is required");
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: city,
          appid: apiKey,
          units: "metric",
        },
      },
    );

    const { name, main, weather } = response.data;

    return {
      city: name,
      temp: main.temp,
      condition: weather[0].main,
    };
  } catch (error) {
    console.error(
      "Error fetching weather data:",
      error.message,
      error.response?.data || "",
    );
    throw new Error("Failed to retrieve weather data");
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  searchUserProfiles,
  createGroup,
  createStudySession,
  getMusicRecommendation,
  chatWithAI,
  clearSessionHistory,
};
