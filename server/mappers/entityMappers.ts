/**
 * Entity Mappers - Transform database rows to domain types
 *
 * These functions handle the conversion from nullable database columns
 * to optional domain properties, ensuring type safety across the boundary.
 */

import type {
  Paper,
  Annotation,
  NoteAtom,
  ResearchChatMessage,
  Settings,
  AnnotationType,
  NoteType,
  ChatRole,
  ResearchActionType,
  PaperStatus,
} from "@shared/types"
import type {
  papers,
  annotations,
  noteAtoms,
  researchChatMessagesTable,
  settingsTable,
} from "@shared/schema"

/**
 * Maps a paper database row to the Paper domain type.
 * Converts null values to undefined for optional fields.
 */
export function mapPaperRow(row: typeof papers.$inferSelect): Paper {
  return {
    id: row.id,
    title: row.title || undefined,
    authors: row.authors || undefined,
    abstract: row.abstract || undefined,
    filename: row.filename,
    filePath: row.filePath,
    createdAt: row.createdAt,
    extractedText: row.extractedText || undefined,
    references: row.references || undefined,
    // New fields
    status: (row.status as PaperStatus) || "unread",
    lastPageRead: row.lastPageRead || undefined,
    tags: row.tags || undefined,
    arxivId: row.arxivId || undefined,
    doi: row.doi || undefined,
    webUrl: row.webUrl || undefined,
    pdfVaultPath: row.pdfVaultPath || undefined,
    year: row.year || undefined,
  }
}

/**
 * Maps an annotation database row to the Annotation domain type.
 * Casts annotationType string to the AnnotationType union.
 */
export function mapAnnotationRow(row: typeof annotations.$inferSelect): Annotation {
  return {
    id: row.id,
    paperId: row.paperId,
    pageIndex: row.pageIndex,
    boundingBox: row.boundingBox,
    quotedText: row.quotedText || undefined,
    comment: row.comment || undefined,
    annotationType: row.annotationType as AnnotationType,
    createdAt: row.createdAt,
  }
}

/**
 * Maps a note atom database row to the NoteAtom domain type.
 * Casts noteType string to the NoteType union.
 */
export function mapNoteRow(row: typeof noteAtoms.$inferSelect): NoteAtom {
  return {
    id: row.id,
    paperId: row.paperId,
    noteType: row.noteType as NoteType,
    content: row.content,
    linkedAnnotationIds: row.linkedAnnotationIds,
    outboundLinks: row.outboundLinks,
    createdAt: row.createdAt,
    aiProvenance: row.aiProvenance || undefined,
  }
}

/**
 * Maps a chat message database row to the ResearchChatMessage domain type.
 * Casts role and actionType strings to their respective union types.
 */
export function mapChatMessageRow(
  row: typeof researchChatMessagesTable.$inferSelect
): ResearchChatMessage {
  return {
    id: row.id,
    paperId: row.paperId,
    role: row.role as ChatRole,
    content: row.content,
    selectedText: row.selectedText || undefined,
    actionType: row.actionType as ResearchActionType | undefined,
    createdAt: row.createdAt,
  }
}

/**
 * Maps a settings database row to the Settings domain type.
 */
export function mapSettingsRow(row: typeof settingsTable.$inferSelect): Settings {
  return {
    vaultPath: row.vaultPath,
  }
}
