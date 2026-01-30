/**
 * PDF Service - Handles PDF processing and text extraction.
 *
 * This service encapsulates all PDF-related operations including
 * text extraction and reference parsing.
 */

import * as pdfParseModule from "pdf-parse"
import { findReferencesSection, parseReferences } from "../referenceExtractor"
import type { Reference } from "@shared/types"

const pdfParse = (pdfParseModule as any).default || pdfParseModule

/**
 * Result of PDF text and reference extraction.
 */
export interface PdfExtractionResult {
  extractedText?: string
  references?: Reference[]
}

export const pdfService = {
  /**
   * Extract text and references from a PDF buffer.
   *
   * @param buffer - The PDF file buffer
   * @returns Extracted text and parsed references
   */
  async extractTextAndReferences(buffer: Buffer): Promise<PdfExtractionResult> {
    let extractedText: string | undefined
    let references: Reference[] | undefined

    try {
      const pdfData = await pdfParse(buffer)
      extractedText = pdfData.text || ""

      // Extract references section if text was extracted
      if (extractedText) {
        const referencesSection = findReferencesSection(extractedText)
        if (referencesSection) {
          references = parseReferences(referencesSection)
          console.log(`Extracted ${references.length} references from PDF`)
        }
      }
    } catch (parseError) {
      console.error("PDF text extraction failed:", parseError)
      // Return undefined values - extraction is optional
    }

    return {
      extractedText,
      references,
    }
  },

  /**
   * Extract only text from a PDF buffer (without reference parsing).
   *
   * @param buffer - The PDF file buffer
   * @returns Extracted text or undefined if extraction failed
   */
  async extractText(buffer: Buffer): Promise<string | undefined> {
    try {
      const pdfData = await pdfParse(buffer)
      return pdfData.text || undefined
    } catch (parseError) {
      console.error("PDF text extraction failed:", parseError)
      return undefined
    }
  },
}
