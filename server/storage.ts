/**
 * Storage Layer - Backward-compatible wrapper over repositories
 *
 * This file provides the IStorage interface for backward compatibility
 * while delegating all operations to the new repository layer.
 * New code should import directly from ./repositories instead.
 */

import type {
  Paper,
  InsertPaper,
  Annotation,
  InsertAnnotation,
  UpdateAnnotation,
  NoteAtom,
  InsertNoteAtom,
  UpdateNoteAtom,
  Settings,
  ResearchChatMessage,
  InsertResearchChatMessage,
} from "@shared/types"

import {
  paperRepository,
  annotationRepository,
  noteRepository,
  chatRepository,
  settingsRepository,
} from "./repositories"

export interface IStorage {
  getPapers(): Promise<Paper[]>
  getPaper(id: string): Promise<Paper | undefined>
  getPaperByFilePath(filePath: string): Promise<Paper | undefined>
  createPaper(paper: InsertPaper, stableId?: string): Promise<Paper>

  getAnnotations(paperId: string): Promise<Annotation[]>
  getAnnotation(id: string): Promise<Annotation | undefined>
  createAnnotation(annotation: InsertAnnotation): Promise<Annotation>
  updateAnnotation(id: string, updates: UpdateAnnotation): Promise<Annotation | undefined>

  getNotes(paperId: string): Promise<NoteAtom[]>
  getNote(id: string): Promise<NoteAtom | undefined>
  createNote(note: InsertNoteAtom): Promise<NoteAtom>
  updateNote(id: string, updates: UpdateNoteAtom): Promise<NoteAtom | undefined>
  deleteNote(id: string): Promise<boolean>

  getSettings(): Promise<Settings>
  updateSettings(settings: Partial<Settings>): Promise<Settings>

  getResearchChatMessages(paperId: string): Promise<ResearchChatMessage[]>
  createResearchChatMessage(message: InsertResearchChatMessage): Promise<ResearchChatMessage>
  clearResearchChatMessages(paperId: string): Promise<void>
}

/**
 * DatabaseStorage - IStorage implementation using the repository layer.
 *
 * @deprecated Use repositories directly for new code:
 *   import { paperRepository, annotationRepository, ... } from "./repositories"
 */
export class DatabaseStorage implements IStorage {
  // Paper operations
  async getPapers(): Promise<Paper[]> {
    return paperRepository.findAll()
  }

  async getPaper(id: string): Promise<Paper | undefined> {
    return paperRepository.findById(id)
  }

  async getPaperByFilePath(filePath: string): Promise<Paper | undefined> {
    return paperRepository.findByFilePath(filePath)
  }

  async createPaper(paper: InsertPaper, stableId?: string): Promise<Paper> {
    return paperRepository.create(paper, stableId)
  }

  // Annotation operations
  async getAnnotations(paperId: string): Promise<Annotation[]> {
    return annotationRepository.findByPaperId(paperId)
  }

  async getAnnotation(id: string): Promise<Annotation | undefined> {
    return annotationRepository.findById(id)
  }

  async createAnnotation(annotation: InsertAnnotation): Promise<Annotation> {
    return annotationRepository.create(annotation)
  }

  async updateAnnotation(id: string, updates: UpdateAnnotation): Promise<Annotation | undefined> {
    return annotationRepository.update(id, updates)
  }

  // Note operations
  async getNotes(paperId: string): Promise<NoteAtom[]> {
    return noteRepository.findByPaperId(paperId)
  }

  async getNote(id: string): Promise<NoteAtom | undefined> {
    return noteRepository.findById(id)
  }

  async createNote(note: InsertNoteAtom): Promise<NoteAtom> {
    return noteRepository.create(note)
  }

  async updateNote(id: string, updates: UpdateNoteAtom): Promise<NoteAtom | undefined> {
    return noteRepository.update(id, updates)
  }

  async deleteNote(id: string): Promise<boolean> {
    return noteRepository.delete(id)
  }

  // Settings operations
  async getSettings(): Promise<Settings> {
    return settingsRepository.get()
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    return settingsRepository.update(settings)
  }

  // Chat operations
  async getResearchChatMessages(paperId: string): Promise<ResearchChatMessage[]> {
    return chatRepository.findByPaperId(paperId)
  }

  async createResearchChatMessage(message: InsertResearchChatMessage): Promise<ResearchChatMessage> {
    return chatRepository.create(message)
  }

  async clearResearchChatMessages(paperId: string): Promise<void> {
    return chatRepository.clearByPaperId(paperId)
  }
}

export const storage = new DatabaseStorage()
