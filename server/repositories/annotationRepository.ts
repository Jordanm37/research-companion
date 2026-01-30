/**
 * Annotation Repository - Data access layer for annotations
 */

import { randomUUID } from "crypto"
import { eq, asc } from "drizzle-orm"
import { db } from "../db"
import { annotations } from "@shared/schema"
import type { Annotation, InsertAnnotation, UpdateAnnotation } from "@shared/types"
import { mapAnnotationRow } from "../mappers/entityMappers"

export const annotationRepository = {
  /**
   * Find all annotations for a paper, sorted by page index and vertical position.
   */
  async findByPaperId(paperId: string): Promise<Annotation[]> {
    const rows = await db
      .select()
      .from(annotations)
      .where(eq(annotations.paperId, paperId))
      .orderBy(asc(annotations.pageIndex))

    // Additional sorting by vertical position within each page
    return rows.map(mapAnnotationRow).sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
      return a.boundingBox.y - b.boundingBox.y
    })
  },

  /**
   * Find an annotation by its unique ID.
   */
  async findById(id: string): Promise<Annotation | undefined> {
    const rows = await db.select().from(annotations).where(eq(annotations.id, id))
    return rows[0] ? mapAnnotationRow(rows[0]) : undefined
  },

  /**
   * Create a new annotation.
   */
  async create(data: InsertAnnotation): Promise<Annotation> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const newAnnotation = {
      id,
      paperId: data.paperId,
      pageIndex: data.pageIndex,
      boundingBox: data.boundingBox,
      quotedText: data.quotedText || null,
      comment: data.comment || null,
      annotationType: data.annotationType,
      createdAt: now,
    }

    await db.insert(annotations).values(newAnnotation)

    return mapAnnotationRow(newAnnotation)
  },

  /**
   * Update an existing annotation.
   * Currently only supports updating the comment field.
   */
  async update(id: string, updates: UpdateAnnotation): Promise<Annotation | undefined> {
    const existing = await this.findById(id)
    if (!existing) return undefined

    await db
      .update(annotations)
      .set({ comment: updates.comment })
      .where(eq(annotations.id, id))

    return this.findById(id)
  },
}
