import { z } from "zod";
import { pgTable, text, integer, json, varchar } from "drizzle-orm/pg-core";

// ================================
// Core Types (defined first for use in tables)
// ================================

// Bounding box coordinates in page space
export const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof boundingBoxSchema>;

// Extracted reference from a paper's bibliography
export const referenceSchema = z.object({
  index: z.number(),
  rawText: z.string(),
  authors: z.string().optional(),
  year: z.string().optional(),
  title: z.string().optional(),
});
export type Reference = z.infer<typeof referenceSchema>;

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
});

export const annotations = pgTable("annotations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paperId: varchar("paper_id", { length: 36 }).notNull().references(() => papers.id),
  pageIndex: integer("page_index").notNull(),
  boundingBox: json("bounding_box").notNull().$type<BoundingBox>(),
  quotedText: text("quoted_text"),
  comment: text("comment"),
  annotationType: text("annotation_type").notNull(),
  createdAt: text("created_at").notNull(),
});

export const noteAtoms = pgTable("note_atoms", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paperId: varchar("paper_id", { length: 36 }).notNull().references(() => papers.id),
  noteType: text("note_type").notNull(),
  content: text("content").notNull(),
  linkedAnnotationIds: json("linked_annotation_ids").notNull().$type<string[]>(),
  outboundLinks: json("outbound_links").notNull().$type<string[]>(),
  createdAt: text("created_at").notNull(),
  aiProvenance: text("ai_provenance"),
});

export const researchChatMessagesTable = pgTable("research_chat_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paperId: varchar("paper_id", { length: 36 }).notNull().references(() => papers.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  selectedText: text("selected_text"),
  actionType: text("action_type"),
  createdAt: text("created_at").notNull(),
});

export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  vaultPath: text("vault_path").notNull().default("/obsidian-vault"),
});

// ================================
// Zod Schemas for Validation
// ================================

// Note type enum
export const noteTypeEnum = z.enum([
  "summary",
  "critique",
  "question",
  "insight",
  "connection",
  "methodology",
  "finding",
  "custom"
]);
export type NoteType = z.infer<typeof noteTypeEnum>;

// Annotation types
export const annotationTypeEnum = z.enum([
  "highlight",
  "margin_note",
  "rectangle"
]);
export type AnnotationType = z.infer<typeof annotationTypeEnum>;

// Paper schema
export const paperSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  authors: z.array(z.string()).optional(),
  abstract: z.string().optional(),
  filename: z.string(),
  filePath: z.string(),
  createdAt: z.string(),
  extractedText: z.string().optional(),
  references: z.array(referenceSchema).optional(),
});
export type Paper = z.infer<typeof paperSchema>;

export const insertPaperSchema = paperSchema.omit({ id: true, createdAt: true });
export type InsertPaper = z.infer<typeof insertPaperSchema>;

// Annotation schema
export const annotationSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  pageIndex: z.number(),
  boundingBox: boundingBoxSchema,
  quotedText: z.string().optional(),
  comment: z.string().optional(),
  annotationType: annotationTypeEnum,
  createdAt: z.string(),
});
export type Annotation = z.infer<typeof annotationSchema>;

export const insertAnnotationSchema = annotationSchema.omit({ id: true, createdAt: true });
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;

export const updateAnnotationSchema = z.object({
  comment: z.string().optional(),
});
export type UpdateAnnotation = z.infer<typeof updateAnnotationSchema>;

// Note atom schema
export const noteAtomSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  noteType: noteTypeEnum,
  content: z.string(),
  linkedAnnotationIds: z.array(z.string()),
  outboundLinks: z.array(z.string()),
  createdAt: z.string(),
  aiProvenance: z.string().optional(),
});
export type NoteAtom = z.infer<typeof noteAtomSchema>;

export const insertNoteAtomSchema = noteAtomSchema.omit({ id: true, createdAt: true }).refine(
  (data) => data.linkedAnnotationIds.length > 0,
  { message: "At least one linked annotation is required", path: ["linkedAnnotationIds"] }
);
export type InsertNoteAtom = z.infer<typeof insertNoteAtomSchema>;

export const updateNoteAtomSchema = z.object({
  content: z.string().optional(),
  noteType: noteTypeEnum.optional(),
  outboundLinks: z.array(z.string()).optional(),
});
export type UpdateNoteAtom = z.infer<typeof updateNoteAtomSchema>;

// AI action types
export const aiActionTypeEnum = z.enum([
  "summarize",
  "critique",
  "question",
  "connect",
  "expand"
]);
export type AIActionType = z.infer<typeof aiActionTypeEnum>;

export const aiRequestSchema = z.object({
  actionType: aiActionTypeEnum,
  annotationIds: z.array(z.string()).optional(),
  noteAtomIds: z.array(z.string()).optional(),
  contextNotes: z.array(z.string()).optional(),
});
export type AIRequest = z.infer<typeof aiRequestSchema>;

// Export request schema
export const exportRequestSchema = z.object({
  paperId: z.string(),
  vaultPath: z.string(),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;

// Settings schema
export const settingsSchema = z.object({
  vaultPath: z.string(),
});
export type Settings = z.infer<typeof settingsSchema>;

// Research chat action types
export const researchActionTypeEnum = z.enum([
  "find_similar",
  "explore_topic",
  "ask_question",
  "custom_query",
  "paper_summary"
]);
export type ResearchActionType = z.infer<typeof researchActionTypeEnum>;

// Research chat message schema
export const researchChatMessageSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  selectedText: z.string().optional(),
  actionType: researchActionTypeEnum.optional(),
  createdAt: z.string(),
});
export type ResearchChatMessage = z.infer<typeof researchChatMessageSchema>;

export const insertResearchChatMessageSchema = researchChatMessageSchema.omit({ id: true, createdAt: true });
export type InsertResearchChatMessage = z.infer<typeof insertResearchChatMessageSchema>;

// Research chat request schema
export const researchChatRequestSchema = z.object({
  query: z.string(),
  selectedText: z.string().optional().default(""),
  actionType: researchActionTypeEnum,
});
export type ResearchChatRequest = z.infer<typeof researchChatRequestSchema>;

// Legacy user types for compatibility
export const users = { $inferSelect: {} as { id: string; username: string; password: string } };
export type User = typeof users.$inferSelect;
export const insertUserSchema = z.object({ username: z.string(), password: z.string() });
export type InsertUser = z.infer<typeof insertUserSchema>;
