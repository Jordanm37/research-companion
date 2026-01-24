import { z } from "zod";

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

// Bounding box coordinates in page space
export const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof boundingBoxSchema>;

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

// Legacy user types for compatibility
export const users = { $inferSelect: {} as { id: string; username: string; password: string } };
export type User = typeof users.$inferSelect;
export const insertUserSchema = z.object({ username: z.string(), password: z.string() });
export type InsertUser = z.infer<typeof insertUserSchema>;
