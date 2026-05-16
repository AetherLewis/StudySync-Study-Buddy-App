const { getRecommendations } = require("../services/recommendationService");

/**
 * @swagger
 * tags:
 *   - name: AI Resource Recommendations
 *     description: AI-powered personalized resource recommendations
 */

/**
 * @swagger
 * /api/resources/recommendations:
 *   get:
 *     summary: Get AI-powered personalized resource recommendations
 *     tags: [AI Resource Recommendations]
 *     security:
 *       - bearerAuth: []
 *     description: Analyzes user's learning history and goals to recommend relevant resources
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 *       400:
 *         description: Failed to generate recommendations
 *       500:
 *         description: Server error
 */
exports.getResourceRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getRecommendations(userId);

    res.status(200).json({
      success: true,
      recommendations: result.recommendations,
    });
  } catch (error) {
    console.error("Resource recommendation error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get resource recommendations",
    });
  }
};
