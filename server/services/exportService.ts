/**
 * Export Service - Handles Markdown/Obsidian export functionality.
 *
 * This service generates markdown content for papers, annotations,
 * and notes for export to Obsidian or other markdown-based systems.
 */

import path from "path"
import type { Paper, Annotation, NoteAtom, ResearchChatMessage } from "@shared/types"
import type { ChatSynthesis } from "./chatSynthesisService"

export interface ExportOptions {
  includeResearchTemplate?: boolean
  includeChatSynthesis?: boolean
  vaultPdfPath?: string // Relative path to PDFs in vault
}

export const exportService = {
  /**
   * Generate a complete markdown document for a paper.
   *
   * @param paper - The paper to export
   * @param annotations - Annotations for the paper
   * @param notes - Notes for the paper
   * @param chatSynthesis - Optional chat synthesis
   * @param options - Export options
   * @returns The markdown content as a string
   */
  generateMarkdown(
    paper: Paper,
    annotations: Annotation[],
    notes: NoteAtom[],
    chatSynthesis?: ChatSynthesis,
    options: ExportOptions = {}
  ): string {
    const mdLines: string[] = []

    // ================================
    // YAML Frontmatter
    // ================================
    mdLines.push("---")
    mdLines.push(`paper_id: "${paper.id}"`)
    mdLines.push(`title: "${this.escapeYaml(paper.title || paper.filename)}"`)

    // Authors
    if (paper.authors && paper.authors.length > 0) {
      mdLines.push(`authors:`)
      paper.authors.forEach((a) => mdLines.push(`  - "${this.escapeYaml(a)}"`))
    }

    // Academic metadata
    if (paper.year) mdLines.push(`year: ${paper.year}`)
    if (paper.arxivId) mdLines.push(`arxiv: "${paper.arxivId}"`)
    if (paper.doi) mdLines.push(`doi: "${paper.doi}"`)

    // Status and organization
    mdLines.push(`status: "${paper.status}"`)
    if (paper.tags && paper.tags.length > 0) {
      mdLines.push(`tags:`)
      paper.tags.forEach((t) => mdLines.push(`  - "${t}"`))
    }

    // Dates
    mdLines.push(`created: "${paper.createdAt}"`)
    mdLines.push(`exported: "${new Date().toISOString()}"`)

    // Reading progress
    if (paper.lastPageRead) {
      mdLines.push(`last_page: ${paper.lastPageRead}`)
    }

    mdLines.push("---")
    mdLines.push("")

    // ================================
    // Title and Links
    // ================================
    mdLines.push(`# ${paper.title || paper.filename}`)
    mdLines.push("")

    // PDF Links section
    mdLines.push("## Source")
    mdLines.push("")
    const pdfLinks: string[] = []

    // Local vault path
    if (options.vaultPdfPath || paper.pdfVaultPath) {
      const vaultPath = options.vaultPdfPath || paper.pdfVaultPath
      pdfLinks.push(`- **Local**: [[${vaultPath}]]`)
    }

    // Web URL
    if (paper.webUrl) {
      pdfLinks.push(`- **Web**: [${paper.webUrl}](${paper.webUrl})`)
    } else if (paper.arxivId) {
      pdfLinks.push(`- **arXiv**: [https://arxiv.org/abs/${paper.arxivId}](https://arxiv.org/abs/${paper.arxivId})`)
    }

    // DOI
    if (paper.doi) {
      pdfLinks.push(`- **DOI**: [${paper.doi}](https://doi.org/${paper.doi})`)
    }

    if (pdfLinks.length > 0) {
      mdLines.push(...pdfLinks)
    } else {
      mdLines.push(`- Local file: \`${paper.filename}\``)
    }
    mdLines.push("")

    // Abstract
    if (paper.abstract) {
      mdLines.push("## Abstract")
      mdLines.push("")
      mdLines.push(`> ${paper.abstract}`)
      mdLines.push("")
    }

    // ================================
    // Research Template (if enabled)
    // ================================
    if (options.includeResearchTemplate !== false) {
      mdLines.push("## Reading Notes")
      mdLines.push("")
      mdLines.push("### Key Findings")
      mdLines.push("")
      mdLines.push("- ")
      mdLines.push("")
      mdLines.push("### Methodology")
      mdLines.push("")
      mdLines.push("- ")
      mdLines.push("")
      mdLines.push("### Contributions")
      mdLines.push("")
      mdLines.push("- ")
      mdLines.push("")
      mdLines.push("### Limitations")
      mdLines.push("")
      mdLines.push("- ")
      mdLines.push("")
      mdLines.push("### My Questions")
      mdLines.push("")
      mdLines.push("- ")
      mdLines.push("")
    }

    // ================================
    // Notes (separated by source)
    // ================================
    const manualNotes = notes.filter((n) => !n.aiProvenance)
    const aiNotes = notes.filter((n) => n.aiProvenance)

    // Manual notes first
    if (manualNotes.length > 0) {
      mdLines.push("## My Notes")
      mdLines.push("")
      this.appendNotesByType(mdLines, manualNotes)
    }

    // AI-generated notes in separate section
    if (aiNotes.length > 0) {
      mdLines.push("## AI-Generated Notes")
      mdLines.push("")
      mdLines.push("> [!note] AI Generated")
      mdLines.push("> The following notes were generated with AI assistance.")
      mdLines.push("")
      this.appendNotesByType(mdLines, aiNotes)
    }

    // ================================
    // Chat Synthesis (if provided)
    // ================================
    if (chatSynthesis && options.includeChatSynthesis !== false) {
      mdLines.push("## Research Chat Summary")
      mdLines.push("")

      if (chatSynthesis.summary && chatSynthesis.summary !== "No conversation to synthesize.") {
        mdLines.push(chatSynthesis.summary)
        mdLines.push("")
      }

      if (chatSynthesis.keyInsights.length > 0) {
        mdLines.push("### Key Insights")
        mdLines.push("")
        chatSynthesis.keyInsights.forEach((insight) => {
          mdLines.push(`- ${insight}`)
        })
        mdLines.push("")
      }

      if (chatSynthesis.papersDiscovered.length > 0) {
        mdLines.push("### Papers Discovered")
        mdLines.push("")
        chatSynthesis.papersDiscovered.forEach((paper) => {
          mdLines.push(`- ${paper}`)
        })
        mdLines.push("")
      }

      if (chatSynthesis.questionsExplored.length > 0) {
        mdLines.push("### Questions Explored")
        mdLines.push("")
        chatSynthesis.questionsExplored.forEach((q) => {
          mdLines.push(`- ${q}`)
        })
        mdLines.push("")
      }
    }

    // ================================
    // Highlights / Annotation Index
    // ================================
    if (annotations.length > 0) {
      mdLines.push("## Highlights & Annotations")
      mdLines.push("")

      // Sort by page then position
      const sorted = [...annotations].sort((a, b) => {
        if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
        return a.boundingBox.y - b.boundingBox.y
      })

      sorted.forEach((ann) => {
        mdLines.push(`<!-- annotation_id: ${ann.id} -->`)

        const typeEmoji = {
          highlight: "🟡",
          rectangle: "📦",
          margin_note: "📝",
        }[ann.annotationType] || "•"

        mdLines.push(`### ${typeEmoji} Page ${ann.pageIndex + 1}`)
        mdLines.push("")

        if (ann.quotedText) {
          mdLines.push(`> ${ann.quotedText}`)
          mdLines.push("")
        }

        if (ann.comment) {
          mdLines.push(`**Note:** ${ann.comment}`)
          mdLines.push("")
        }
      })
    }

    return mdLines.join("\n")
  },

  /**
   * Append notes grouped by type to the markdown lines.
   */
  appendNotesByType(mdLines: string[], notes: NoteAtom[]): void {
    const notesByType = new Map<string, NoteAtom[]>()
    notes.forEach((note) => {
      const existing = notesByType.get(note.noteType) || []
      existing.push(note)
      notesByType.set(note.noteType, existing)
    })

    notesByType.forEach((typeNotes, type) => {
      mdLines.push(`### ${this.capitalizeFirst(type)}`)
      mdLines.push("")

      typeNotes.forEach((note) => {
        mdLines.push(`<!-- note_id: ${note.id} -->`)
        mdLines.push(note.content)

        if (note.outboundLinks.length > 0) {
          mdLines.push("")
          mdLines.push("Related: " + note.outboundLinks.map((l) => `[[${l}]]`).join(", "))
        }

        mdLines.push("")
      })
    })
  },

  /**
   * Escape special characters for YAML strings.
   */
  escapeYaml(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\n/g, " ")
  },

  /**
   * Capitalize first letter.
   */
  capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  },

  /**
   * Sanitize a title for use as a filename.
   */
  sanitizeFilename(title: string): string {
    return title
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80)
  },

  /**
   * Build the full file path for export.
   */
  buildFilePath(paper: Paper, vaultPath: string): string {
    const sanitizedTitle = this.sanitizeFilename(paper.title || paper.filename)
    const filename = `${sanitizedTitle}.md`
    return path.join(vaultPath, filename)
  },

  /**
   * Get just the filename for a paper.
   */
  getFilename(paper: Paper): string {
    const sanitizedTitle = this.sanitizeFilename(paper.title || paper.filename)
    return `${sanitizedTitle}.md`
  },
}
