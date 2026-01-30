/**
 * Note Repository - Data access layer for note atoms
 */

import { randomUUID } from "crypto"
import { eq, asc } from "drizzle-orm"
import { db } from "../db"
import { noteAtoms } from "@shared/schema"
import type { NoteAtom, InsertNoteAtom, UpdateNoteAtom } from "@shared/types"
import { mapNoteRow } from "../mappers/entityMappers"

export const noteRepository = {
  /**
   * Find all notes for a paper, ordered by creation date.
   */
  async findByPaperId(paperId: string): Promise<NoteAtom[]> {
    const rows = await db
      .select()
      .from(noteAtoms)
      .where(eq(noteAtoms.paperId, paperId))
      .orderBy(asc(noteAtoms.createdAt))

    return rows.map(mapNoteRow)
  },

  /**
   * Find a note by its unique ID.
   */
  async findById(id: string): Promise<NoteAtom | undefined> {
    const rows = await db.select().from(noteAtoms).where(eq(noteAtoms.id, id))
    return rows[0] ? mapNoteRow(rows[0]) : undefined
  },

  /**
   * Create a new note atom.
   */
  async create(data: InsertNoteAtom): Promise<NoteAtom> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const newNote = {
      id,
      paperId: data.paperId,
      noteType: data.noteType,
      content: data.content,
      linkedAnnotationIds: data.linkedAnnotationIds,
      outboundLinks: data.outboundLinks,
      createdAt: now,
      aiProvenance: data.aiProvenance || null,
    }

    await db.insert(noteAtoms).values(newNote)

    return mapNoteRow(newNote)
  },

  /**
   * Update an existing note.
   * Supports updating content, noteType, and outboundLinks.
   */
  async update(id: string, updates: UpdateNoteAtom): Promise<NoteAtom | undefined> {
    const existing = await this.findById(id)
    if (!existing) return undefined

    const updateData: Partial<typeof noteAtoms.$inferInsert> = {}
    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.noteType !== undefined) updateData.noteType = updates.noteType
    if (updates.outboundLinks !== undefined) updateData.outboundLinks = updates.outboundLinks

    await db.update(noteAtoms).set(updateData).where(eq(noteAtoms.id, id))

    return this.findById(id)
  },

  /**
   * Delete a note by ID.
   * Returns true if the note was deleted (or didn't exist).
   */
  async delete(id: string): Promise<boolean> {
    await db.delete(noteAtoms).where(eq(noteAtoms.id, id))
    return true
  },
}
