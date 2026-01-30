import { z } from "zod"

// ================================
// Zod Schemas for API Validation
// ================================

// ================================
// Primitive/Value Schemas
// ================================

/**
 * Bounding box coordinates in page space
 */
export const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

/**
 * Extracted reference from a paper's bibliography
 */
export const referenceSchema = z.object({
  index: z.number(),
  rawText: z.string(),
  authors: z.string().optional(),
  year: z.string().optional(),
  title: z.string().optional(),
})

// ================================
// Enum Schemas
// ================================

export const noteTypeEnum = z.enum([
  "summary",
  "critique",
  "question",
  "insight",
  "connection",
  "methodology",
  "finding",
  "custom"
])

export const annotationTypeEnum = z.enum([
  "highlight",
  "margin_note",
  "rectangle"
])

export const aiActionTypeEnum = z.enum([
  "summarize",
  "critique",
  "question",
  "connect",
  "expand"
])

export const researchActionTypeEnum = z.enum([
  "find_similar",
  "explore_topic",
  "ask_question",
  "custom_query",
  "paper_summary"
])

export const chatRoleEnum = z.enum(["user", "assistant"])

export const paperStatusEnum = z.enum(["unread", "reading", "done", "archived"])

// ================================
// Entity Schemas
// ================================

/**
 * Paper validation schema
 */
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
  // New fields for paper management
  status: paperStatusEnum,
  lastPageRead: z.number().optional(),
  tags: z.array(z.string()).optional(),
  arxivId: z.string().optional(),
  doi: z.string().optional(),
  webUrl: z.string().optional(),
  pdfVaultPath: z.string().optional(),
  year: z.string().optional(),
})

export const insertPaperSchema = paperSchema.omit({ id: true, createdAt: true }).extend({
  status: paperStatusEnum.optional().default("unread"),
})

export const updatePaperSchema = z.object({
  title: z.string().optional(),
  authors: z.array(z.string()).optional(),
  abstract: z.string().optional(),
  status: paperStatusEnum.optional(),
  lastPageRead: z.number().optional(),
  tags: z.array(z.string()).optional(),
  arxivId: z.string().optional(),
  doi: z.string().optional(),
  webUrl: z.string().optional(),
  pdfVaultPath: z.string().optional(),
  year: z.string().optional(),
})

/**
 * Annotation validation schema
 */
export const annotationSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  pageIndex: z.number(),
  boundingBox: boundingBoxSchema,
  quotedText: z.string().optional(),
  comment: z.string().optional(),
  annotationType: annotationTypeEnum,
  createdAt: z.string(),
})

export const insertAnnotationSchema = annotationSchema.omit({ id: true, createdAt: true })

export const updateAnnotationSchema = z.object({
  comment: z.string().optional(),
})

/**
 * Note atom validation schema
 */
export const noteAtomSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  noteType: noteTypeEnum,
  content: z.string(),
  linkedAnnotationIds: z.array(z.string()),
  outboundLinks: z.array(z.string()),
  createdAt: z.string(),
  aiProvenance: z.string().optional(),
})

export const insertNoteAtomSchema = noteAtomSchema.omit({ id: true, createdAt: true }).refine(
  (data) => data.linkedAnnotationIds.length > 0,
  { message: "At least one linked annotation is required", path: ["linkedAnnotationIds"] }
)

export const updateNoteAtomSchema = z.object({
  content: z.string().optional(),
  noteType: noteTypeEnum.optional(),
  outboundLinks: z.array(z.string()).optional(),
})

/**
 * Research chat message validation schema
 */
export const researchChatMessageSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  role: chatRoleEnum,
  content: z.string(),
  selectedText: z.string().optional(),
  actionType: researchActionTypeEnum.optional(),
  createdAt: z.string(),
})

export const insertResearchChatMessageSchema = researchChatMessageSchema.omit({ id: true, createdAt: true })

// ================================
// Request Schemas
// ================================

/**
 * AI action request validation schema
 */
export const aiRequestSchema = z.object({
  actionType: aiActionTypeEnum,
  annotationIds: z.array(z.string()).optional(),
  noteAtomIds: z.array(z.string()).optional(),
  contextNotes: z.array(z.string()).optional(),
})

/**
 * Export request validation schema
 */
export const exportRequestSchema = z.object({
  paperId: z.string(),
  vaultPath: z.string(),
})

/**
 * Research chat request validation schema
 */
export const researchChatRequestSchema = z.object({
  query: z.string(),
  selectedText: z.string().optional().default(""),
  actionType: researchActionTypeEnum,
})

/**
 * Settings validation schema
 */
export const settingsSchema = z.object({
  vaultPath: z.string(),
})

// ================================
// Legacy User Schema (for compatibility)
// ================================

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
})
