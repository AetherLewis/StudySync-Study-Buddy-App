const {
  createFlashcard,
  getFlashcards,
  updateFlashcard,
  deleteFlashcard,
  reviewFlashcard,
  generateFlashcards,
} = require("../services/flashcardService");

/**
 * @swagger
 * tags:
 *   - name: Flashcards
 *     description: Flashcard creation, review, and generation
 */

/**
 * @swagger
 * /api/flashcards:
 *   post:
 *     summary: Create a new flashcard
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - front
 *               - back
 *             properties:
 *               front:
 *                 type: string
 *               back:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Flashcard created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
exports.createFlashcard = async (req, res) => {
  try {
    const userId = req.user.id;
    const flashcard = await createFlashcard(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Flashcard created successfully",
      flashcard,
    });
  } catch (error) {
    console.error("Create flashcard error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /api/flashcards:
 *   get:
 *     summary: Get user flashcards
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: due
 *         schema:
 *           type: boolean
 *         description: Return only flashcards due for review
 *     responses:
 *       200:
 *         description: Flashcards retrieved successfully
 *       500:
 *         description: Server error
 */
exports.getFlashcards = async (req, res) => {
  try {
    const userId = req.user.id;
    const dueOnly = req.query.due === "true";
    const flashcards = await getFlashcards(userId, dueOnly);

    res.json({
      success: true,
      flashcards,
    });
  } catch (error) {
    console.error("Get flashcards error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to get flashcards" });
  }
};

/**
 * @swagger
 * /api/flashcards/{id}:
 *   put:
 *     summary: Update a flashcard
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Flashcard ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               front:
 *                 type: string
 *               back:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Flashcard updated successfully
 *       404:
 *         description: Flashcard not found
 *       500:
 *         description: Server error
 */
exports.updateFlashcard = async (req, res) => {
  try {
    const userId = req.user.id;
    const flashcard = await updateFlashcard(userId, req.params.id, req.body);

    res.json({
      success: true,
      message: "Flashcard updated successfully",
      flashcard,
    });
  } catch (error) {
    console.error("Update flashcard error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /api/flashcards/{id}:
 *   delete:
 *     summary: Delete a flashcard
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Flashcard ID
 *     responses:
 *       200:
 *         description: Flashcard deleted successfully
 *       404:
 *         description: Flashcard not found
 *       500:
 *         description: Server error
 */
exports.deleteFlashcard = async (req, res) => {
  try {
    const userId = req.user.id;
    await deleteFlashcard(userId, req.params.id);

    res.json({
      success: true,
      message: "Flashcard deleted successfully",
    });
  } catch (error) {
    console.error("Delete flashcard error:", error.message);
    res.status(404).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /api/flashcards/{id}/review:
 *   post:
 *     summary: Review a flashcard and update spaced repetition scheduling
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Flashcard ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quality
 *             properties:
 *               quality:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Flashcard review recorded
 *       400:
 *         description: Validation error
 *       404:
 *         description: Flashcard not found
 *       500:
 *         description: Server error
 */
exports.reviewFlashcard = async (req, res) => {
  try {
    const userId = req.user.id;
    const quality = Number(req.body.quality);
    const flashcard = await reviewFlashcard(userId, req.params.id, quality);

    res.json({
      success: true,
      message: "Flashcard review recorded successfully",
      flashcard,
    });
  } catch (error) {
    console.error("Review flashcard error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /api/flashcards/generate:
 *   post:
 *     summary: Generate flashcards from text using AI
 *     tags: [Flashcards]
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
 *               count:
 *                 type: number
 *                 default: 5
 *     responses:
 *       200:
 *         description: Flashcards generated successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
exports.generateFlashcards = async (req, res) => {
  try {
    const { text, count } = req.body;
    const flashcards = await generateFlashcards(text, count || 5);

    res.json({
      success: true,
      message: "Flashcards generated successfully",
      flashcards,
    });
  } catch (error) {
    console.error("Generate flashcards error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};
