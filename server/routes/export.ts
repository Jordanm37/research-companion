/**
 * Export Routes - Obsidian/Markdown export functionality.
 *
 * Handles:
 * - POST /api/papers/:paperId/export - Export to Obsidian vault
 * - GET /api/papers/:paperId/preview - Preview export data
 */

import { Router } from "express"
import fs from "fs"
import { paperRepository, annotationRepository, noteRepository, chatRepository } from "../repositories"
import { exportService } from "../services/exportService"
import { chatSynthesisService } from "../services/chatSynthesisService"
import { exportRequestSchema } from "@shared/validation"

const router = Router()

// ================================
// Type Definitions
// ================================

interface PaperParams {
  paperId: string
}

// ================================
// Routes
// ================================

/**
 * POST /:paperId/export
 * Export a paper with its annotations and notes to an Obsidian vault.
 *
 * Creates or updates a markdown file in the specified vault path.
 */
router.post<PaperParams>("/:paperId/export", async (req, res) => {
  try {
    const parsed = exportRequestSchema.safeParse({
      ...req.body,
      paperId: req.params.paperId,
    })

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message })
    }

    const { paperId, vaultPath } = parsed.data

    // Fetch paper data
    const paper = await paperRepository.findById(paperId)
    if (!paper) {
      return res.status(404).json({ error: "Paper not found" })
    }

    // Fetch annotations, notes, and chat messages
    const annotations = await annotationRepository.findByPaperId(paperId)
    const notes = await noteRepository.findByPaperId(paperId)
    const chatMessages = await chatRepository.findByPaperId(paperId)

    // Generate chat synthesis if there are messages
    const chatSynthesis = chatMessages.length > 0
      ? await chatSynthesisService.synthesize(chatMessages)
      : undefined

    // Get export options from request body
    const exportOptions = {
      includeResearchTemplate: req.body.includeResearchTemplate !== false,
      includeChatSynthesis: req.body.includeChatSynthesis !== false,
      vaultPdfPath: req.body.vaultPdfPath,
    }

    // Generate markdown content
    const mdContent = exportService.generateMarkdown(paper, annotations, notes, chatSynthesis, exportOptions)

    // Build file path
    const filePath = exportService.buildFilePath(paper, vaultPath)
    const filename = exportService.getFilename(paper)

    // Write or update file
    try {
      // Ensure vault directory exists
      if (!fs.existsSync(vaultPath)) {
        fs.mkdirSync(vaultPath, { recursive: true })
      }

      // Write the file (create or overwrite)
      // In a full implementation, this would do proper ID-based merging
      // to preserve manually added sections
      fs.writeFileSync(filePath, mdContent, "utf-8")

      res.json({
        success: true,
        path: filePath,
        filename,
      })
    } catch (writeError) {
      console.error("Write error:", writeError)
      res.status(500).json({ error: "Failed to write to vault path" })
    }
  } catch (error) {
    console.error("Export error:", error)
    res.status(500).json({ error: "Failed to export" })
  }
})

/**
 * GET /:paperId/preview
 * Get a preview of the export data without writing to disk.
 *
 * Returns the paper, annotations, notes, chat messages, and counts.
 */
router.get<PaperParams>("/:paperId/preview", async (req, res) => {
  try {
    const paper = await paperRepository.findById(req.params.paperId)
    if (!paper) {
      return res.status(404).json({ error: "Paper not found" })
    }

    const annotations = await annotationRepository.findByPaperId(req.params.paperId)
    const notes = await noteRepository.findByPaperId(req.params.paperId)
    const chatMessages = await chatRepository.findByPaperId(req.params.paperId)

    res.json({
      paper,
      annotations,
      notes,
      chatMessages,
      annotationCount: annotations.length,
      noteCount: notes.length,
      chatMessageCount: chatMessages.length,
    })
  } catch (error) {
    console.error("Preview error:", error)
    res.status(500).json({ error: "Failed to get preview" })
  }
})

export default router
