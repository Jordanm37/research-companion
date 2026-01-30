import { pgTable, text, integer, json, varchar } from "drizzle-orm/pg-core"

// Import types for use in table definitions
import type { BoundingBox, Reference } from "./types"

// ================================
// Drizzle Tables for Database
// ================================

export const papers = pgTable("papers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: text("title"),
  authors: json("authors").$type<string[]>(),
  abstract: text("abstract"),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull().unique(),
  createdAt: text("created_at").notNull(),
  extractedText: text("extracted_text"),
  references: json("references").$type<Reference[]>(),
  // New fields for paper management
  status: text("status").notNull().default("unread"),
  lastPageRead: integer("last_page_read"),
  tags: json("tags").$type<string[]>(),
  arxivId: text("arxiv_id"),
  doi: text("doi"),
  webUrl: text("web_url"),
  pdfVaultPath: text("pdf_vault_path"),
  year: text("year"),
})

export const annotations = pgTable("annotations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paperId: varchar("paper_id", { length: 36 }).notNull().references(() => papers.id),
  pageIndex: integer("page_index").notNull(),
  boundingBox: json("bounding_box").notNull().$type<BoundingBox>(),
  quotedText: text("quoted_text"),
  comment: text("comment"),
  annotationType: text("annotation_type").notNull(),
  createdAt: text("created_at").notNull(),
})

export const noteAtoms = pgTable("note_atoms", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paperId: varchar("paper_id", { length: 36 }).notNull().references(() => papers.id),
  noteType: text("note_type").notNull(),
  content: text("content").notNull(),
  linkedAnnotationIds: json("linked_annotation_ids").notNull().$type<string[]>(),
  outboundLinks: json("outbound_links").notNull().$type<string[]>(),
  createdAt: text("created_at").notNull(),
  aiProvenance: text("ai_provenance"),
})

export const researchChatMessagesTable = pgTable("research_chat_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paperId: varchar("paper_id", { length: 36 }).notNull().references(() => papers.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  selectedText: text("selected_text"),
  actionType: text("action_type"),
  createdAt: text("created_at").notNull(),
})

export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  vaultPath: text("vault_path").notNull().default("/obsidian-vault"),
})

// ================================
// Legacy User Types (for compatibility)
// ================================

export const users = { $inferSelect: {} as { id: string; username: string; password: string } }

// ================================
// Re-exports for Backward Compatibility
// All existing imports from @shared/schema will continue to work
// ================================

// Re-export pure types (interfaces and type aliases)
export type {
  BoundingBox,
  Reference,
  Paper,
  Annotation,
  NoteAtom,
  ResearchChatMessage,
  Settings,
  InsertPaper,
  UpdatePaper,
  InsertAnnotation,
  UpdateAnnotation,
  InsertNoteAtom,
  UpdateNoteAtom,
  InsertResearchChatMessage,
  AIRequest,
  ExportRequest,
  ResearchChatRequest,
  User,
  InsertUser,
} from "./types"

// Re-export const enums (these also make their types available)
export {
  NoteType,
  AnnotationType,
  AIActionType,
  ResearchActionType,
  ChatRole,
  PaperStatus,
} from "./types"

// Re-export all validation schemas
export {
  boundingBoxSchema,
  referenceSchema,
  noteTypeEnum,
  annotationTypeEnum,
  aiActionTypeEnum,
  researchActionTypeEnum,
  chatRoleEnum,
  paperStatusEnum,
  paperSchema,
  insertPaperSchema,
  updatePaperSchema,
  annotationSchema,
  insertAnnotationSchema,
  updateAnnotationSchema,
  noteAtomSchema,
  insertNoteAtomSchema,
  updateNoteAtomSchema,
  researchChatMessageSchema,
  insertResearchChatMessageSchema,
  aiRequestSchema,
  exportRequestSchema,
  researchChatRequestSchema,
  settingsSchema,
  insertUserSchema,
} from "./validation"
