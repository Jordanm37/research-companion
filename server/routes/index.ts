/**
 * Routes Index - Router composition.
 *
 * Combines all route modules into a single API router.
 * This is the main entry point for all API routes.
 *
 * Route structure:
 * - /papers/* - Paper CRUD, PDF handling, references
 * - /papers/:paperId/annotations - Annotation operations (paper-scoped)
 * - /papers/:paperId/notes - Note operations (paper-scoped)
 * - /papers/:paperId/ai - AI generation (paper-scoped)
 * - /papers/:paperId/research-chat - Research chat (paper-scoped)
 * - /papers/:paperId/export - Export (paper-scoped)
 * - /papers/:paperId/preview - Preview (paper-scoped)
 * - /annotations/:id - Annotation updates (annotation-scoped)
 * - /notes/:id - Note updates/deletes (note-scoped)
 * - /audio/* - Audio services (TTS, STT, voice chat)
 * - /ingest - Paper ingestion from URLs
 */

import { Router } from "express"
import papersRouter from "./papers"
import annotationsRouter from "./annotations"
import notesRouter from "./notes"
import researchChatRouter from "./researchChat"
import exportRouter from "./export"
import audioRouter from "./audio"
import ingestRouter from "./ingest"

const router = Router()

// ================================
// Route Mounting
// ================================

/**
 * Papers routes - Paper CRUD and PDF handling
 * Handles routes under /papers base path
 */
router.use("/papers", papersRouter)

/**
 * Export routes - Obsidian/Markdown export
 * Mount under /papers to handle /papers/:paperId/export and /preview
 */
router.use("/papers", exportRouter)

/**
 * Annotations routes - Annotation CRUD
 * Has mixed paths:
 * - /papers/:paperId/annotations (paper-scoped)
 * - /annotations/:id (annotation-scoped)
 */
router.use("/", annotationsRouter)

/**
 * Notes routes - Note CRUD and AI generation
 * Has mixed paths:
 * - /papers/:paperId/notes (paper-scoped)
 * - /papers/:paperId/ai (paper-scoped)
 * - /notes/:id (note-scoped)
 */
router.use("/", notesRouter)

/**
 * Research chat routes - Chat with AI assistant (SSE streaming)
 * Has mixed paths:
 * - /papers/:paperId/research-chat (paper-scoped)
 */
router.use("/", researchChatRouter)

/**
 * Audio routes - TTS, STT, voice chat
 * Handles routes under /audio base path
 */
router.use("/audio", audioRouter)

/**
 * Ingest routes - Paper ingestion from URLs
 * POST /ingest - Ingest paper from arxiv URL or PDF link
 * POST /ingest/validate - Validate URL without ingesting
 */
router.use("/ingest", ingestRouter)

export default router
