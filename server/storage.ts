import { 
  type Paper, 
  type InsertPaper,
  type Annotation, 
  type InsertAnnotation,
  type UpdateAnnotation,
  type NoteAtom,
  type InsertNoteAtom,
  type UpdateNoteAtom,
  type Settings
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Papers
  getPapers(): Promise<Paper[]>;
  getPaper(id: string): Promise<Paper | undefined>;
  getPaperByFilePath(filePath: string): Promise<Paper | undefined>;
  createPaper(paper: InsertPaper, stableId?: string): Promise<Paper>;
  
  // Annotations
  getAnnotations(paperId: string): Promise<Annotation[]>;
  getAnnotation(id: string): Promise<Annotation | undefined>;
  createAnnotation(annotation: InsertAnnotation): Promise<Annotation>;
  updateAnnotation(id: string, updates: UpdateAnnotation): Promise<Annotation | undefined>;
  
  // Notes
  getNotes(paperId: string): Promise<NoteAtom[]>;
  getNote(id: string): Promise<NoteAtom | undefined>;
  createNote(note: InsertNoteAtom): Promise<NoteAtom>;
  updateNote(id: string, updates: UpdateNoteAtom): Promise<NoteAtom | undefined>;
  deleteNote(id: string): Promise<boolean>;
  
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;
}

export class MemStorage implements IStorage {
  private papers: Map<string, Paper>;
  private annotations: Map<string, Annotation>;
  private notes: Map<string, NoteAtom>;
  private settings: Settings;

  constructor() {
    this.papers = new Map();
    this.annotations = new Map();
    this.notes = new Map();
    this.settings = { vaultPath: "/obsidian-vault" };
  }

  // Papers
  async getPapers(): Promise<Paper[]> {
    return Array.from(this.papers.values());
  }

  async getPaper(id: string): Promise<Paper | undefined> {
    return this.papers.get(id);
  }

  async getPaperByFilePath(filePath: string): Promise<Paper | undefined> {
    return Array.from(this.papers.values()).find(p => p.filePath === filePath);
  }

  async createPaper(paper: InsertPaper, stableId?: string): Promise<Paper> {
    const id = stableId || randomUUID();
    const now = new Date().toISOString();
    const newPaper: Paper = {
      id,
      ...paper,
      createdAt: now,
    };
    this.papers.set(id, newPaper);
    return newPaper;
  }

  // Annotations
  async getAnnotations(paperId: string): Promise<Annotation[]> {
    return Array.from(this.annotations.values())
      .filter(a => a.paperId === paperId)
      .sort((a, b) => {
        if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
        return a.boundingBox.y - b.boundingBox.y;
      });
  }

  async getAnnotation(id: string): Promise<Annotation | undefined> {
    return this.annotations.get(id);
  }

  async createAnnotation(annotation: InsertAnnotation): Promise<Annotation> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newAnnotation: Annotation = {
      id,
      ...annotation,
      createdAt: now,
    };
    this.annotations.set(id, newAnnotation);
    return newAnnotation;
  }

  async updateAnnotation(id: string, updates: UpdateAnnotation): Promise<Annotation | undefined> {
    const annotation = this.annotations.get(id);
    if (!annotation) return undefined;
    
    const updated: Annotation = {
      ...annotation,
      ...updates,
    };
    this.annotations.set(id, updated);
    return updated;
  }

  // Notes
  async getNotes(paperId: string): Promise<NoteAtom[]> {
    return Array.from(this.notes.values())
      .filter(n => n.paperId === paperId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getNote(id: string): Promise<NoteAtom | undefined> {
    return this.notes.get(id);
  }

  async createNote(note: InsertNoteAtom): Promise<NoteAtom> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newNote: NoteAtom = {
      id,
      ...note,
      createdAt: now,
    };
    this.notes.set(id, newNote);
    return newNote;
  }

  async updateNote(id: string, updates: UpdateNoteAtom): Promise<NoteAtom | undefined> {
    const note = this.notes.get(id);
    if (!note) return undefined;
    
    const updated: NoteAtom = {
      ...note,
      ...updates,
    };
    this.notes.set(id, updated);
    return updated;
  }

  async deleteNote(id: string): Promise<boolean> {
    return this.notes.delete(id);
  }

  // Settings
  async getSettings(): Promise<Settings> {
    return this.settings;
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...updates };
    return this.settings;
  }
}

export const storage = new MemStorage();
