/**
 * Ingestion Routes - API endpoints for paper ingestion from URLs
 */

import { Router, Request, Response } from "express"
import { z } from "zod"
import { ingestionService } from "../services/ingestionService"

const router = Router()

// Validation schema for ingestion request
const ingestRequestSchema = z.object({
  url: z.string().url("Invalid URL format"),
  title: z.string().optional(),
})

/**
 * POST /api/ingest
 * Ingest a paper from URL (arxiv, PDF link, etc.)
 *
 * Request body:
 * - url: string (required) - The URL to ingest from
 * - title: string (optional) - Override title for direct PDF links
 *
 * Response:
 * - success: boolean
 * - paper: Paper object (if successful)
 * - error: string (if failed)
 * - alreadyExists: boolean (if paper was already in library)
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parseResult = ingestRequestSchema.safeParse(req.body)

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues.map((e) => e.message).join(", "),
      })
    }

    const { url, title } = parseResult.data

    // Perform ingestion
    const result = await ingestionService.ingest(url)

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      })
    }

    // Return result with appropriate status
    const statusCode = result.alreadyExists ? 200 : 201

    return res.status(statusCode).json({
      success: true,
      paper: result.paper,
      alreadyExists: result.alreadyExists || false,
    })
  } catch (error) {
    console.error("Ingestion error:", error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    })
  }
})

/**
 * POST /api/ingest/validate
 * Validate a URL without ingesting
 *
 * Request body:
 * - url: string (required) - The URL to validate
 *
 * Response:
 * - valid: boolean
 * - type: 'arxiv' | 'pdf' | 'unknown'
 * - arxivId: string (if arxiv URL)
 */
router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { url } = req.body

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        valid: false,
        type: "unknown",
        error: "URL is required",
      })
    }

    const normalizedUrl = url.trim()

    // Check arxiv
    const arxivId = ingestionService.parseArxivUrl(normalizedUrl)
    if (arxivId) {
      return res.json({
        valid: true,
        type: "arxiv",
        arxivId,
      })
    }

    // Check PDF
    if (normalizedUrl.endsWith(".pdf") || normalizedUrl.includes("/pdf/")) {
      return res.json({
        valid: true,
        type: "pdf",
      })
    }

    return res.json({
      valid: false,
      type: "unknown",
      error: "Unsupported URL format",
    })
  } catch (error) {
    return res.status(500).json({
      valid: false,
      type: "unknown",
      error: error instanceof Error ? error.message : "Validation failed",
    })
  }
})

export default router
