const {
  previewLearningPath,
  generateAndSaveLearningPath,
} = require("../services/learningPathService");

/**
 * @swagger
 * tags:
 *   - name: AI Learning Paths
 *     description: AI-powered personalized learning path generation
 */

/**
 * @swagger
 * /api/learning-paths/preview:
 *   post:
 *     summary: Preview an AI-generated learning path without saving
 *     tags: [AI Learning Paths]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goalTitle
 *             properties:
 *               goalTitle:
 *                 type: string
 *                 description: The title of the learning goal.
 *               goalDescription:
 *                 type: string
 *                 description: Description of the learning goal.
 *               currentLevel:
 *                 type: string
 *                 description: Current proficiency level (Beginner, Intermediate, Advanced).
 *               timeframe:
 *                 type: string
 *                 description: Expected timeframe for completion (e.g., "30 days", "3 months").
 *     responses:
 *       200:
 *         description: Learning path preview generated successfully
 *       400:
 *         description: Validation error or malformed AI output
 *       500:
 *         description: Server error
 */
exports.previewLearningPath = async (req, res) => {
  try {
    const preview = await previewLearningPath(req.body);

    res.status(200).json({
      success: true,
      path: preview,
    });
  } catch (error) {
    console.error("Learning path preview error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to preview learning path",
    });
  }
};

/**
 * @swagger
 * /api/learning-paths/generate:
 *   post:
 *     summary: Generate a learning path and save it as calendar events
 *     tags: [AI Learning Paths]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goalTitle
 *             properties:
 *               goalTitle:
 *                 type: string
 *               goalDescription:
 *                 type: string
 *               currentLevel:
 *                 type: string
 *               timeframe:
 *                 type: string
 *     responses:
 *       201:
 *         description: Learning path generated and saved as events successfully
 *       400:
 *         description: Validation error or malformed AI output
 *       500:
 *         description: Server error
 */
exports.generateLearningPath = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await generateAndSaveLearningPath(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Learning path generated successfully",
      path: result.path,
      eventsCreated: result.events.length,
    });
  } catch (error) {
    console.error("Learning path generation error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to generate learning path",
    });
  }
};
