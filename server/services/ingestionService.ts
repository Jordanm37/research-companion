/**
 * Ingestion Service - Handles paper ingestion from URLs
 *
 * Supports:
 * - arxiv URLs (abstracts and PDFs)
 * - DOI URLs
 * - Direct PDF URLs
 */

import { randomUUID } from "crypto"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { paperRepository } from "../repositories/paperRepository"
import { pdfService } from "./pdfService"
import type { Paper, InsertPaper } from "@shared/types"

// Storage directory for PDFs
const PDF_STORAGE_DIR = process.env.PDF_STORAGE_DIR || "./uploads"

export interface IngestionResult {
  success: boolean
  paper?: Paper
  error?: string
  alreadyExists?: boolean
}

export interface ArxivMetadata {
  arxivId: string
  title: string
  authors: string[]
  abstract: string
  published: string
  pdfUrl: string
  webUrl: string
  doi?: string
}

/**
 * Parse various URL formats to extract arxiv ID
 */
function parseArxivUrl(url: string): string | null {
  // Handle various arxiv URL formats:
  // https://arxiv.org/abs/2301.00001
  // https://arxiv.org/pdf/2301.00001.pdf
  // https://arxiv.org/abs/2301.00001v2
  // https://export.arxiv.org/abs/2301.00001
  // arxiv:2301.00001

  const patterns = [
    /arxiv\.org\/abs\/(\d+\.\d+(?:v\d+)?)/i,
    /arxiv\.org\/pdf\/(\d+\.\d+(?:v\d+)?)(?:\.pdf)?/i,
    /arxiv:(\d+\.\d+(?:v\d+)?)/i,
    // Old format: arxiv.org/abs/hep-ph/0001234
    /arxiv\.org\/abs\/([a-z-]+\/\d+)/i,
    /arxiv\.org\/pdf\/([a-z-]+\/\d+)(?:\.pdf)?/i,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

/**
 * Fetch metadata from arxiv API
 */
async function fetchArxivMetadata(arxivId: string): Promise<ArxivMetadata | null> {
  try {
    const apiUrl = `http://export.arxiv.org/api/query?id_list=${arxivId}`
    const response = await fetch(apiUrl)

    if (!response.ok) {
      console.error(`Arxiv API error: ${response.status}`)
      return null
    }

    const xml = await response.text()

    // Parse XML response (simple regex-based for now)
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/)
    const abstractMatch = xml.match(/<summary>([\s\S]+?)<\/summary>/)
    const publishedMatch = xml.match(/<published>([^<]+)<\/published>/)
    const doiMatch = xml.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/)

    // Extract authors
    const authorMatches = xml.matchAll(/<author>\s*<name>([^<]+)<\/name>\s*<\/author>/g)
    const authors = Array.from(authorMatches).map((m) => m[1].trim())

    // Get title (skip the first one which is the feed title)
    const allTitles = xml.matchAll(/<title>([^<]+)<\/title>/g)
    const titlesArray = Array.from(allTitles).map((m) => m[1].trim())
    const title = titlesArray.length > 1 ? titlesArray[1] : titlesArray[0] || "Unknown Title"

    if (!title || authors.length === 0) {
      console.error("Could not parse arxiv metadata")
      return null
    }

    // Clean up the arxiv ID (remove version suffix for consistent storage)
    const baseId = arxivId.replace(/v\d+$/, "")

    return {
      arxivId: baseId,
      title: title.replace(/\s+/g, " ").trim(),
      authors,
      abstract: abstractMatch ? abstractMatch[1].replace(/\s+/g, " ").trim() : "",
      published: publishedMatch ? publishedMatch[1] : "",
      pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
      webUrl: `https://arxiv.org/abs/${arxivId}`,
      doi: doiMatch ? doiMatch[1] : undefined,
    }
  } catch (error) {
    console.error("Error fetching arxiv metadata:", error)
    return null
  }
}

/**
 * Download PDF from URL
 */
async function downloadPdf(url: string, filename: string): Promise<string | null> {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`Failed to download PDF: ${response.status}`)
      return null
    }

    const buffer = await response.arrayBuffer()

    // Ensure storage directory exists
    await mkdir(PDF_STORAGE_DIR, { recursive: true })

    const filePath = path.join(PDF_STORAGE_DIR, filename)
    await writeFile(filePath, Buffer.from(buffer))

    return filePath
  } catch (error) {
    console.error("Error downloading PDF:", error)
    return null
  }
}

/**
 * Generate a safe filename from title
 */
function generateFilename(title: string, arxivId?: string): string {
  const sanitized = title
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .toLowerCase()

  const suffix = arxivId ? `-${arxivId.replace("/", "-")}` : `-${randomUUID().slice(0, 8)}`
  return `${sanitized}${suffix}.pdf`
}

/**
 * Extract year from arxiv ID or published date
 */
function extractYear(arxivId: string, published?: string): string | undefined {
  // New format: 2301.00001 -> 2023
  const newFormatMatch = arxivId.match(/^(\d{2})(\d{2})\./)
  if (newFormatMatch) {
    const century = parseInt(newFormatMatch[1]) < 50 ? "20" : "19"
    return `${century}${newFormatMatch[1]}`
  }

  // Old format: try to extract from published date
  if (published) {
    const yearMatch = published.match(/(\d{4})/)
    if (yearMatch) return yearMatch[1]
  }

  return undefined
}

export const ingestionService = {
  /**
   * Ingest a paper from an arxiv URL
   */
  async ingestFromArxiv(url: string): Promise<IngestionResult> {
    const arxivId = parseArxivUrl(url)

    if (!arxivId) {
      return { success: false, error: "Invalid arxiv URL format" }
    }

    // Check if paper already exists
    const existing = await paperRepository.findByArxivId(arxivId.replace(/v\d+$/, ""))
    if (existing) {
      return { success: true, paper: existing, alreadyExists: true }
    }

    // Fetch metadata
    const metadata = await fetchArxivMetadata(arxivId)
    if (!metadata) {
      return { success: false, error: "Failed to fetch arxiv metadata" }
    }

    // Download PDF
    const filename = generateFilename(metadata.title, metadata.arxivId)
    const filePath = await downloadPdf(metadata.pdfUrl, filename)

    if (!filePath) {
      return { success: false, error: "Failed to download PDF" }
    }

    // Extract text from PDF
    let extractedText: string | undefined
    let references: any[] | undefined

    try {
      const pdfBuffer = await import("fs/promises").then((fs) => fs.readFile(filePath))
      const extraction = await pdfService.extractTextAndReferences(pdfBuffer)
      extractedText = extraction.extractedText
      references = extraction.references
    } catch (error) {
      console.error("Error extracting PDF content:", error)
      // Continue without extracted text
    }

    // Create paper record
    const paperData: InsertPaper = {
      title: metadata.title,
      authors: metadata.authors,
      abstract: metadata.abstract,
      filename,
      filePath,
      extractedText,
      references,
      status: "unread",
      arxivId: metadata.arxivId,
      doi: metadata.doi,
      webUrl: metadata.webUrl,
      year: extractYear(metadata.arxivId, metadata.published),
    }

    const paper = await paperRepository.create(paperData)

    return { success: true, paper }
  },

  /**
   * Ingest a paper from a direct PDF URL
   */
  async ingestFromPdfUrl(url: string, title?: string): Promise<IngestionResult> {
    // Generate filename
    const urlFilename = url.split("/").pop()?.replace(/[?#].*$/, "") || "paper.pdf"
    const filename = title
      ? generateFilename(title)
      : `${urlFilename.replace(".pdf", "")}-${randomUUID().slice(0, 8)}.pdf`

    // Download PDF
    const filePath = await downloadPdf(url, filename)

    if (!filePath) {
      return { success: false, error: "Failed to download PDF" }
    }

    // Extract text from PDF
    let extractedText: string | undefined
    let references: any[] | undefined

    try {
      const pdfBuffer = await import("fs/promises").then((fs) => fs.readFile(filePath))
      const extraction = await pdfService.extractTextAndReferences(pdfBuffer)
      extractedText = extraction.extractedText
      references = extraction.references
    } catch (error) {
      console.error("Error extracting PDF content:", error)
    }

    // Create paper record
    const paperData: InsertPaper = {
      title: title || urlFilename.replace(".pdf", ""),
      filename,
      filePath,
      extractedText,
      references,
      status: "unread",
      webUrl: url,
    }

    const paper = await paperRepository.create(paperData)

    return { success: true, paper }
  },

  /**
   * Smart ingest - detects URL type and routes to appropriate handler
   */
  async ingest(url: string): Promise<IngestionResult> {
    const normalizedUrl = url.trim()

    // Check if it's an arxiv URL
    if (normalizedUrl.includes("arxiv.org") || normalizedUrl.startsWith("arxiv:")) {
      return this.ingestFromArxiv(normalizedUrl)
    }

    // Check if it's a direct PDF link
    if (normalizedUrl.endsWith(".pdf") || normalizedUrl.includes("/pdf/")) {
      return this.ingestFromPdfUrl(normalizedUrl)
    }

    // TODO: Add DOI resolution
    // TODO: Add Semantic Scholar URL support

    return { success: false, error: "Unsupported URL format. Supported: arxiv URLs, direct PDF links" }
  },

  /**
   * Parse arxiv URL without ingesting (useful for validation)
   */
  parseArxivUrl,
}
