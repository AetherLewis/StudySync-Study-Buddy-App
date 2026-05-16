const {
  generateStudyMaterialFromPrompt,
} = require("../services/materialService");

/**
 * @swagger
 * tags:
 *   - name: AI Study Materials
 *     description: AI-powered generation of study material entries
 */

/**
 * @swagger
 * /api/study-materials/generate:
 *   post:
 *     summary: Generate a study material entry using AI and save it
 *     tags: [AI Study Materials]
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
 *                 description: The topic or notes to convert into study material.
 *               category:
 *                 type: string
 *                 description: Optional category for the generated material.
 *     responses:
 *       201:
 *         description: Study material generated and saved successfully
 *       400:
 *         description: Validation error or malformed AI output
 *       500:
 *         description: Server error
 */
exports.generateStudyMaterial = async (req, res) => {
  try {
    const userId = req.user.id;
    const material = await generateStudyMaterialFromPrompt(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Study material generated successfully",
      material,
    });
  } catch (error) {
    console.error("Study material generation error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to generate study material",
    });
  }
};

exports.previewStudyMaterial = async (req, res) => {
  try {
    const preview = await previewStudyMaterialFromPrompt(req.body);

    res.status(200).json({
      success: true,
      material: preview,
    });
  } catch (error) {
    console.error("Study material preview error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to preview study material",
    });
  }
};
