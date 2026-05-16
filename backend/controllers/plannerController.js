const { generateStudyPlan } = require("../services/plannerService");

/**
 * @swagger
 * tags:
 *   - name: AI Planner
 *     description: AI-powered study plan generation
 */

/**
 * @swagger
 * /api/events/generate:
 *   post:
 *     summary: Generate a study schedule using AI and save events to the planner
 *     tags: [AI Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The user's study goals, topics, and availability details.
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Optional schedule start date.
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Optional schedule end date.
 *               dailyHours:
 *                 type: number
 *                 description: Target study hours per day.
 *     responses:
 *       201:
 *         description: Study plan generated and saved successfully.
 *       400:
 *         description: Validation error or malformed AI output.
 *       500:
 *         description: Server error.
 */
exports.generateStudyPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const events = await generateStudyPlan(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Study plan generated successfully",
      events,
    });
  } catch (error) {
    console.error("Study plan generation error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to generate study plan",
    });
  }
};
