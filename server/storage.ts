import { 
  type Paper, 
  type InsertPaper,
  type Annotation, 
  type InsertAnnotation,
  type UpdateAnnotation,
  type NoteAtom,
  type InsertNoteAtom,
  type UpdateNoteAtom,
  type Settings,
  type ResearchChatMessage,
  type InsertResearchChatMessage,
  type AnnotationType,
  papers,
  annotations,
  noteAtoms,
  researchChatMessagesTable,
  settingsTable
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, asc, desc } from "drizzle-orm";

export interface IStorage {
  getPapers(): Promise<Paper[]>;
  getPaper(id: string): Promise<Paper | undefined>;
  getPaperByFilePath(filePath: string): Promise<Paper | undefined>;
  createPaper(paper: InsertPaper, stableId?: string): Promise<Paper>;
  
  getAnnotations(paperId: string): Promise<Annotation[]>;
  getAnnotation(id: string): Promise<Annotation | undefined>;
  createAnnotation(annotation: InsertAnnotation): Promise<Annotation>;
  updateAnnotation(id: string, updates: UpdateAnnotation): Promise<Annotation | undefined>;
  
  getNotes(paperId: string): Promise<NoteAtom[]>;
  getNote(id: string): Promise<NoteAtom | undefined>;
  createNote(note: InsertNoteAtom): Promise<NoteAtom>;
  updateNote(id: string, updates: UpdateNoteAtom): Promise<NoteAtom | undefined>;
  deleteNote(id: string): Promise<boolean>;
  
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;
  
  getResearchChatMessages(paperId: string): Promise<ResearchChatMessage[]>;
  createResearchChatMessage(message: InsertResearchChatMessage): Promise<ResearchChatMessage>;
  clearResearchChatMessages(paperId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getPapers(): Promise<Paper[]> {
    const rows = await db.select().from(papers).orderBy(desc(papers.createdAt));
    return rows.map(this.mapPaperRow);
  }

  async getPaper(id: string): Promise<Paper | undefined> {
    const rows = await db.select().from(papers).where(eq(papers.id, id));
    return rows[0] ? this.mapPaperRow(rows[0]) : undefined;
  }

  async getPaperByFilePath(filePath: string): Promise<Paper | undefined> {
    const rows = await db.select().from(papers).where(eq(papers.filePath, filePath));
    return rows[0] ? this.mapPaperRow(rows[0]) : undefined;
  }

  async createPaper(paper: InsertPaper, stableId?: string): Promise<Paper> {
    const id = stableId || randomUUID();
    const now = new Date().toISOString();
    
    const newPaper = {
      id,
      title: paper.title || null,
      authors: paper.authors || null,
      abstract: paper.abstract || null,
      filename: paper.filename,
      filePath: paper.filePath,
      createdAt: now,
      extractedText: paper.extractedText || null,
      references: paper.references || null,
    };
    
    await db.insert(papers).values(newPaper);
    
    return this.mapPaperRow(newPaper);
  }

  private mapPaperRow(row: typeof papers.$inferSelect): Paper {
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
    };
  }

  async getAnnotations(paperId: string): Promise<Annotation[]> {
    const rows = await db.select().from(annotations)
      .where(eq(annotations.paperId, paperId))
      .orderBy(asc(annotations.pageIndex));
    
    return rows.map(this.mapAnnotationRow).sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      return a.boundingBox.y - b.boundingBox.y;
    });
  }

  async getAnnotation(id: string): Promise<Annotation | undefined> {
    const rows = await db.select().from(annotations).where(eq(annotations.id, id));
    return rows[0] ? this.mapAnnotationRow(rows[0]) : undefined;
  }

  async createAnnotation(annotation: InsertAnnotation): Promise<Annotation> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const newAnnotation = {
      id,
      paperId: annotation.paperId,
      pageIndex: annotation.pageIndex,
      boundingBox: annotation.boundingBox,
      quotedText: annotation.quotedText || null,
      comment: annotation.comment || null,
      annotationType: annotation.annotationType,
      createdAt: now,
    };
    
    await db.insert(annotations).values(newAnnotation);
    
    return this.mapAnnotationRow(newAnnotation);
  }

  async updateAnnotation(id: string, updates: UpdateAnnotation): Promise<Annotation | undefined> {
    const existing = await this.getAnnotation(id);
    if (!existing) return undefined;
    
    await db.update(annotations)
      .set({ comment: updates.comment })
      .where(eq(annotations.id, id));
    
    return this.getAnnotation(id);
  }

  private mapAnnotationRow(row: typeof annotations.$inferSelect): Annotation {
    return {
      id: row.id,
      paperId: row.paperId,
      pageIndex: row.pageIndex,
      boundingBox: row.boundingBox,
      quotedText: row.quotedText || undefined,
      comment: row.comment || undefined,
      annotationType: row.annotationType as AnnotationType,
      createdAt: row.createdAt,
    };
  }

  async getNotes(paperId: string): Promise<NoteAtom[]> {
    const rows = await db.select().from(noteAtoms)
      .where(eq(noteAtoms.paperId, paperId))
      .orderBy(asc(noteAtoms.createdAt));
    return rows.map(this.mapNoteRow);
  }

  async getNote(id: string): Promise<NoteAtom | undefined> {
    const rows = await db.select().from(noteAtoms).where(eq(noteAtoms.id, id));
    return rows[0] ? this.mapNoteRow(rows[0]) : undefined;
  }

  async createNote(note: InsertNoteAtom): Promise<NoteAtom> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const newNote = {
      id,
      paperId: note.paperId,
      noteType: note.noteType,
      content: note.content,
      linkedAnnotationIds: note.linkedAnnotationIds,
      outboundLinks: note.outboundLinks,
      createdAt: now,
      aiProvenance: note.aiProvenance || null,
    };
    
    await db.insert(noteAtoms).values(newNote);
    
    return this.mapNoteRow(newNote);
  }

  async updateNote(id: string, updates: UpdateNoteAtom): Promise<NoteAtom | undefined> {
    const existing = await this.getNote(id);
    if (!existing) return undefined;
    
    const updateData: Partial<typeof noteAtoms.$inferInsert> = {};
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.noteType !== undefined) updateData.noteType = updates.noteType;
    if (updates.outboundLinks !== undefined) updateData.outboundLinks = updates.outboundLinks;
    
    await db.update(noteAtoms).set(updateData).where(eq(noteAtoms.id, id));
    
    return this.getNote(id);
  }

  async deleteNote(id: string): Promise<boolean> {
    const result = await db.delete(noteAtoms).where(eq(noteAtoms.id, id));
    return true;
  }

  private mapNoteRow(row: typeof noteAtoms.$inferSelect): NoteAtom {
    return {
      id: row.id,
      paperId: row.paperId,
      noteType: row.noteType as NoteAtom["noteType"],
      content: row.content,
      linkedAnnotationIds: row.linkedAnnotationIds,
      outboundLinks: row.outboundLinks,
      createdAt: row.createdAt,
      aiProvenance: row.aiProvenance || undefined,
    };
  }

  async getSettings(): Promise<Settings> {
    const rows = await db.select().from(settingsTable);
    if (rows[0]) {
      return { vaultPath: rows[0].vaultPath };
    }
    await db.insert(settingsTable).values({ id: 1, vaultPath: "/obsidian-vault" });
    return { vaultPath: "/obsidian-vault" };
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const newSettings = { ...current, ...updates };
    
    await db.update(settingsTable)
      .set({ vaultPath: newSettings.vaultPath })
      .where(eq(settingsTable.id, 1));
    
    return newSettings;
  }

  async getResearchChatMessages(paperId: string): Promise<ResearchChatMessage[]> {
    const rows = await db.select().from(researchChatMessagesTable)
      .where(eq(researchChatMessagesTable.paperId, paperId))
      .orderBy(asc(researchChatMessagesTable.createdAt));
    return rows.map(this.mapChatMessageRow);
  }

  async createResearchChatMessage(message: InsertResearchChatMessage): Promise<ResearchChatMessage> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const newMessage = {
      id,
      paperId: message.paperId,
      role: message.role,
      content: message.content,
      selectedText: message.selectedText || null,
      actionType: message.actionType || null,
      createdAt: now,
    };
    
    await db.insert(researchChatMessagesTable).values(newMessage);
    
    return this.mapChatMessageRow(newMessage);
  }

  async clearResearchChatMessages(paperId: string): Promise<void> {
    await db.delete(researchChatMessagesTable)
      .where(eq(researchChatMessagesTable.paperId, paperId));
  }

  private mapChatMessageRow(row: typeof researchChatMessagesTable.$inferSelect): ResearchChatMessage {
    return {
      id: row.id,
      paperId: row.paperId,
      role: row.role as "user" | "assistant",
      content: row.content,
      selectedText: row.selectedText || undefined,
      actionType: row.actionType as ResearchChatMessage["actionType"],
      createdAt: row.createdAt,
    };
  }
}

export const storage = new DatabaseStorage();
