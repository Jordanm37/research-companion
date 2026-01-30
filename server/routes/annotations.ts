/**
 * Annotations Routes - Annotation CRUD operations.
 *
 * Handles:
 * - GET /api/papers/:paperId/annotations - List annotations for a paper
 * - POST /api/papers/:paperId/annotations - Create a new annotation
 * - PATCH /api/annotations/:id - Update an annotation
 */

import { Router } from "express"
import { annotationRepository } from "../repositories"
import { insertAnnotationSchema, updateAnnotationSchema } from "@shared/validation"

const router = Router()

// ================================
// Paper-Scoped Routes
// ================================

/**
 * GET /papers/:paperId/annotations
 * List all annotations for a paper, sorted by page and position.
 */
router.get("/papers/:paperId/annotations", async (req, res) => {
  try {
    const annotations = await annotationRepository.findByPaperId(req.params.paperId)
    res.json(annotations)
  } catch (error) {
    console.error("Error getting annotations:", error)
    res.status(500).json({ error: "Failed to get annotations" })
  }
})

/**
 * POST /papers/:paperId/annotations
 * Create a new annotation for a paper.
 */
router.post("/papers/:paperId/annotations", async (req, res) => {
  try {
    const data = {
      ...req.body,
      paperId: req.params.paperId,
    }

    const parsed = insertAnnotationSchema.safeParse(data)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message })
    }

    const annotation = await annotationRepository.create(parsed.data)
    res.json(annotation)
  } catch (error) {
    console.error("Create annotation error:", error)
    res.status(500).json({ error: "Failed to create annotation" })
  }
})

// ================================
// Annotation-Scoped Routes
// ================================

/**
 * PATCH /annotations/:id
 * Update an existing annotation (currently only comment field).
 */
router.patch("/annotations/:id", async (req, res) => {
  try {
    const parsed = updateAnnotationSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message })
    }

    const annotation = await annotationRepository.update(req.params.id, parsed.data)
    if (!annotation) {
      return res.status(404).json({ error: "Annotation not found" })
    }

    res.json(annotation)
  } catch (error) {
    console.error("Update annotation error:", error)
    res.status(500).json({ error: "Failed to update annotation" })
  }
})

export default router
