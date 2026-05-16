const { generateQuizFromText } = require("../services/quizService");

/**
 * @swagger
 * tags:
 *   - name: AI Quizzes
 *     description: AI-powered quiz generation and validation
 */

/**
 * @swagger
 * /api/quizzes/generate:
 *   post:
 *     summary: Generate and save a quiz using AI from provided text
 *     tags: [AI Quizzes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: The source text or notes for quiz generation
 *               topic:
 *                 type: string
 *                 description: Optional topic or title hint for the quiz
 *               category:
 *                 type: string
 *                 description: Category label for the generated quiz
 *               count:
 *                 type: integer
 *                 description: Number of questions to generate
 *                 default: 5
 *     responses:
 *       201:
 *         description: Quiz generated and saved successfully
 *       400:
 *         description: Validation error or malformed AI output
 *       500:
 *         description: Server error
 */
exports.generateQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const quiz = await generateQuizFromText(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Quiz generated successfully",
      quiz,
    });
  } catch (error) {
    console.error("Quiz generation error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to generate quiz",
    });
  }
};
