// ================================
// Pure TypeScript Domain Types
// NO Zod, NO Drizzle - just interfaces and type definitions
// ================================

// ================================
// Primitive/Value Types
// ================================

/**
 * Bounding box coordinates in page space
 */
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Extracted reference from a paper's bibliography
 */
export interface Reference {
  index: number
  rawText: string
  authors?: string
  year?: string
  title?: string
}

// ================================
// Enum-like Constants with Types
// ================================

export const NoteType = {
  SUMMARY: "summary",
  CRITIQUE: "critique",
  QUESTION: "question",
  INSIGHT: "insight",
  CONNECTION: "connection",
  METHODOLOGY: "methodology",
  FINDING: "finding",
  CUSTOM: "custom",
} as const
export type NoteType = (typeof NoteType)[keyof typeof NoteType]

export const AnnotationType = {
  HIGHLIGHT: "highlight",
  MARGIN_NOTE: "margin_note",
  RECTANGLE: "rectangle",
} as const
export type AnnotationType = (typeof AnnotationType)[keyof typeof AnnotationType]

export const AIActionType = {
  SUMMARIZE: "summarize",
  CRITIQUE: "critique",
  QUESTION: "question",
  CONNECT: "connect",
  EXPAND: "expand",
} as const
export type AIActionType = (typeof AIActionType)[keyof typeof AIActionType]

export const ResearchActionType = {
  FIND_SIMILAR: "find_similar",
  EXPLORE_TOPIC: "explore_topic",
  ASK_QUESTION: "ask_question",
  CUSTOM_QUERY: "custom_query",
  PAPER_SUMMARY: "paper_summary",
} as const
export type ResearchActionType = (typeof ResearchActionType)[keyof typeof ResearchActionType]

export const PaperStatus = {
  UNREAD: "unread",
  READING: "reading",
  DONE: "done",
  ARCHIVED: "archived",
} as const
export type PaperStatus = (typeof PaperStatus)[keyof typeof PaperStatus]

export const ChatRole = {
  USER: "user",
  ASSISTANT: "assistant",
} as const
export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole]

// ================================
// Domain Entity Types
// ================================

/**
 * A research paper with metadata and extracted content
 */
export interface Paper {
  id: string
  title?: string
  authors?: string[]
  abstract?: string
  filename: string
  filePath: string
  createdAt: string
  extractedText?: string
  references?: Reference[]
  // New fields for paper management
  status: PaperStatus
  lastPageRead?: number
  tags?: string[]
  arxivId?: string
  doi?: string
  webUrl?: string
  pdfVaultPath?: string
  year?: string
}

/**
 * An annotation on a paper (highlight, margin note, or rectangle)
 */
export interface Annotation {
  id: string
  paperId: string
  pageIndex: number
  boundingBox: BoundingBox
  quotedText?: string
  comment?: string
  annotationType: AnnotationType
  createdAt: string
}

/**
 * An atomic note linked to annotations
 */
export interface NoteAtom {
  id: string
  paperId: string
  noteType: NoteType
  content: string
  linkedAnnotationIds: string[]
  outboundLinks: string[]
  createdAt: string
  aiProvenance?: string
}

/**
 * A chat message in the research assistant conversation
 */
export interface ResearchChatMessage {
  id: string
  paperId: string
  role: ChatRole
  content: string
  selectedText?: string
  actionType?: ResearchActionType
  createdAt: string
}

/**
 * Application settings
 */
export interface Settings {
  vaultPath: string
}

// ================================
// Insert/Update Types (for API operations)
// ================================

// InsertPaper: status is optional (defaults to 'unread'), other new fields are optional
export type InsertPaper = Omit<Paper, "id" | "createdAt" | "status"> & {
  status?: PaperStatus
}

export interface UpdatePaper {
  title?: string
  authors?: string[]
  abstract?: string
  status?: PaperStatus
  lastPageRead?: number
  tags?: string[]
  arxivId?: string
  doi?: string
  webUrl?: string
  pdfVaultPath?: string
  year?: string
}

export type InsertAnnotation = Omit<Annotation, "id" | "createdAt">

export interface UpdateAnnotation {
  comment?: string
}

export type InsertNoteAtom = Omit<NoteAtom, "id" | "createdAt">

export interface UpdateNoteAtom {
  content?: string
  noteType?: NoteType
  outboundLinks?: string[]
}

export type InsertResearchChatMessage = Omit<ResearchChatMessage, "id" | "createdAt">

// ================================
// Request Types
// ================================

export interface AIRequest {
  actionType: AIActionType
  annotationIds?: string[]
  noteAtomIds?: string[]
  contextNotes?: string[]
}

export interface ExportRequest {
  paperId: string
  vaultPath: string
}

export interface ResearchChatRequest {
  query: string
  selectedText?: string
  actionType: ResearchActionType
}

// ================================
// Legacy User Types (for compatibility)
// ================================

export interface User {
  id: string
  username: string
  password: string
}

export interface InsertUser {
  username: string
  password: string
}
