/**
 * Notes Routes - Note CRUD and AI generation.
 *
 * Handles:
 * - GET /api/papers/:paperId/notes - List notes for a paper
 * - POST /api/papers/:paperId/notes - Create a new note
 * - PATCH /api/notes/:id - Update a note
 * - DELETE /api/notes/:id - Delete a note
 * - POST /api/papers/:paperId/ai - Generate AI content
 */

import { Router } from "express"
import { noteRepository, annotationRepository } from "../repositories"
import { aiService } from "../ai"
import {
  insertNoteAtomSchema,
  updateNoteAtomSchema,
  aiRequestSchema,
} from "@shared/validation"
import type { AIActionType } from "@shared/types"

const router = Router()

// ================================
// Paper-Scoped Routes
// ================================

/**
 * GET /papers/:paperId/notes
 * List all notes for a paper, ordered by creation date.
 */
router.get("/papers/:paperId/notes", async (req, res) => {
  try {
    const notes = await noteRepository.findByPaperId(req.params.paperId)
    res.json(notes)
  } catch (error) {
    console.error("Error getting notes:", error)
    res.status(500).json({ error: "Failed to get notes" })
  }
})

/**
 * POST /papers/:paperId/notes
 * Create a new note for a paper.
 */
router.post("/papers/:paperId/notes", async (req, res) => {
  try {
    const data = {
      ...req.body,
      paperId: req.params.paperId,
    }

    const parsed = insertNoteAtomSchema.safeParse(data)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message })
    }

    const note = await noteRepository.create(parsed.data)
    res.json(note)
  } catch (error) {
    console.error("Create note error:", error)
    res.status(500).json({ error: "Failed to create note" })
  }
})

/**
 * POST /papers/:paperId/ai
 * Generate AI content from annotations and notes.
 *
 * Uses OpenAI's gpt-4o-mini model for note generation.
 */
router.post("/papers/:paperId/ai", async (req, res) => {
  try {
    const parsed = aiRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message })
    }

    const { actionType, annotationIds, noteAtomIds } = parsed.data

    // Gather context from annotations and notes
    const annotations = annotationIds
      ? await Promise.all(annotationIds.map(id => annotationRepository.findById(id)))
      : []
    const notes = noteAtomIds
      ? await Promise.all(noteAtomIds.map(id => noteRepository.findById(id)))
      : []

    // Generate AI response
    const result = await aiService.generateNote({
      actionType: actionType as AIActionType,
      annotations: annotations.filter(Boolean) as Array<{ quotedText?: string | null; comment?: string | null }>,
      notes: notes.filter(Boolean) as Array<{ content?: string | null; noteType?: string | null }>,
    })

    res.json(result)
  } catch (error) {
    console.error("AI error:", error)
    res.status(500).json({ error: "Failed to process AI request" })
  }
})

// ================================
// Note-Scoped Routes
// ================================

/**
 * PATCH /notes/:id
 * Update an existing note.
 */
router.patch("/notes/:id", async (req, res) => {
  try {
    const parsed = updateNoteAtomSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message })
    }

    const note = await noteRepository.update(req.params.id, parsed.data)
    if (!note) {
      return res.status(404).json({ error: "Note not found" })
    }

    res.json(note)
  } catch (error) {
    console.error("Update note error:", error)
    res.status(500).json({ error: "Failed to update note" })
  }
})

/**
 * DELETE /notes/:id
 * Delete a note by ID.
 */
router.delete("/notes/:id", async (req, res) => {
  try {
    const deleted = await noteRepository.delete(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: "Note not found" })
    }
    res.json({ success: true })
  } catch (error) {
    console.error("Delete note error:", error)
    res.status(500).json({ error: "Failed to delete note" })
  }
})

export default router
