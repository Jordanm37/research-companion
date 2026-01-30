/**
 * Papers Routes - Paper CRUD and PDF handling.
 *
 * Handles:
 * - GET /api/papers - List all papers
 * - POST /api/papers/upload - Upload PDF
 * - GET /api/papers/:paperId/pdf - Serve PDF file
 * - GET /api/papers/:paperId/references - Get parsed references
 */

import { Router } from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import { paperRepository } from "../repositories"
import { pdfService } from "../services/pdfService"
import { updatePaperSchema } from "@shared/validation"

const router = Router()

// ================================
// Multer Configuration
// ================================

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true)
    } else {
      cb(new Error("Only PDF files are allowed"))
    }
  },
})

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true })
}

// ================================
// Utility Functions
// ================================

/**
 * Compute a stable, content-based ID for a paper.
 */
function computePaperId(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16)
}

/**
 * Sanitize a filename to be filesystem-safe.
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100)
}

// ================================
// Routes
// ================================

/**
 * GET /papers
 * List all papers, ordered by creation date (newest first).
 */
router.get("/", async (req, res) => {
  try {
    const papers = await paperRepository.findAll()
    res.json(papers)
  } catch (error) {
    console.error("Error getting papers:", error)
    res.status(500).json({ error: "Failed to get papers" })
  }
})

/**
 * POST /papers/upload
 * Upload a PDF file and create a paper record.
 *
 * - Computes a stable content-based ID
 * - Returns existing paper if already uploaded
 * - Extracts text and references from PDF
 */
router.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    const filePath = req.file.path
    const originalName = req.file.originalname
    const buffer = fs.readFileSync(filePath)
    const stableId = computePaperId(buffer)

    // Check if paper already exists
    const existingPapers = await paperRepository.findAll()
    const existing = existingPapers.find(p => p.id.startsWith(stableId.slice(0, 8)))
    if (existing) {
      // Clean up uploaded file since we already have this paper
      fs.unlinkSync(filePath)
      return res.json(existing)
    }

    // Rename file to stable name
    const sanitizedName = sanitizeFilename(originalName)
    const newPath = path.join("uploads", `${stableId}_${sanitizedName}`)
    fs.renameSync(filePath, newPath)

    // Extract text and references from PDF
    const { extractedText, references } = await pdfService.extractTextAndReferences(buffer)

    // Extract title from filename (remove .pdf extension)
    const title = originalName.replace(/\.pdf$/i, "")

    const paper = await paperRepository.create(
      {
        title,
        filename: originalName,
        filePath: newPath,
        extractedText,
        references,
      },
      stableId
    )

    res.json(paper)
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).json({ error: "Failed to upload paper" })
  }
})

/**
 * GET /papers/:paperId/pdf
 * Serve the PDF file for a paper.
 */
router.get("/:paperId/pdf", async (req, res) => {
  try {
    const paper = await paperRepository.findById(req.params.paperId)
    if (!paper) {
      return res.status(404).json({ error: "Paper not found" })
    }

    // Find the file that matches this paper
    const files = fs.readdirSync("uploads")
    const paperFile = files.find(f => f.startsWith(paper.id))

    if (paperFile) {
      const filePath = path.join("uploads", paperFile)
      if (fs.existsSync(filePath)) {
        res.setHeader("Content-Type", "application/pdf")
        return res.sendFile(path.resolve(filePath))
      }
    }

    // Fallback to stored path
    if (paper.filePath && fs.existsSync(paper.filePath)) {
      res.setHeader("Content-Type", "application/pdf")
      return res.sendFile(path.resolve(paper.filePath))
    }

    res.status(404).json({ error: "PDF file not found" })
  } catch (error) {
    console.error("PDF fetch error:", error)
    res.status(500).json({ error: "Failed to get PDF" })
  }
})

/**
 * GET /papers/:paperId/references
 * Get the parsed references for a paper.
 */
router.get("/:paperId/references", async (req, res) => {
  try {
    const paper = await paperRepository.findById(req.params.paperId)
    if (!paper) {
      return res.status(404).json({ error: "Paper not found" })
    }
    res.json(paper.references || [])
  } catch (error) {
    console.error("Error getting references:", error)
    res.status(500).json({ error: "Failed to get references" })
  }
})

/**
 * GET /papers/:paperId
 * Get a single paper by ID.
 */
router.get("/:paperId", async (req, res) => {
  try {
    const paper = await paperRepository.findById(req.params.paperId)
    if (!paper) {
      return res.status(404).json({ error: "Paper not found" })
    }
    res.json(paper)
  } catch (error) {
    console.error("Error getting paper:", error)
    res.status(500).json({ error: "Failed to get paper" })
  }
})

/**
 * PATCH /papers/:paperId
 * Update a paper's metadata (status, tags, etc.).
 */
router.patch("/:paperId", async (req, res) => {
  try {
    const paper = await paperRepository.findById(req.params.paperId)
    if (!paper) {
      return res.status(404).json({ error: "Paper not found" })
    }

    const parseResult = updatePaperSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid update data",
        details: parseResult.error.issues,
      })
    }

    const updated = await paperRepository.update(req.params.paperId, parseResult.data)
    res.json(updated)
  } catch (error) {
    console.error("Error updating paper:", error)
    res.status(500).json({ error: "Failed to update paper" })
  }
})

export default router
