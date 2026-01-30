/**
 * Paper Repository - Data access layer for papers
 */

import { randomUUID } from "crypto"
import { eq, desc, inArray } from "drizzle-orm"
import { db } from "../db"
import { papers } from "@shared/schema"
import type { Paper, InsertPaper, UpdatePaper, PaperStatus } from "@shared/types"
import { mapPaperRow } from "../mappers/entityMappers"

export const paperRepository = {
  /**
   * Retrieve all papers, ordered by creation date (newest first).
   */
  async findAll(): Promise<Paper[]> {
    const rows = await db.select().from(papers).orderBy(desc(papers.createdAt))
    return rows.map(mapPaperRow)
  },

  /**
   * Find a paper by its unique ID.
   */
  async findById(id: string): Promise<Paper | undefined> {
    const rows = await db.select().from(papers).where(eq(papers.id, id))
    return rows[0] ? mapPaperRow(rows[0]) : undefined
  },

  /**
   * Find a paper by its file path.
   * Useful for checking if a paper has already been imported.
   */
  async findByFilePath(filePath: string): Promise<Paper | undefined> {
    const rows = await db.select().from(papers).where(eq(papers.filePath, filePath))
    return rows[0] ? mapPaperRow(rows[0]) : undefined
  },

  /**
   * Create a new paper.
   * @param data - Paper data without id and createdAt
   * @param stableId - Optional pre-determined ID (useful for testing or migrations)
   */
  async create(data: InsertPaper, stableId?: string): Promise<Paper> {
    const id = stableId || randomUUID()
    const now = new Date().toISOString()

    const newPaper = {
      id,
      title: data.title || null,
      authors: data.authors || null,
      abstract: data.abstract || null,
      filename: data.filename,
      filePath: data.filePath,
      createdAt: now,
      extractedText: data.extractedText || null,
      references: data.references || null,
      // New fields
      status: data.status || "unread",
      lastPageRead: data.lastPageRead || null,
      tags: data.tags || null,
      arxivId: data.arxivId || null,
      doi: data.doi || null,
      webUrl: data.webUrl || null,
      pdfVaultPath: data.pdfVaultPath || null,
      year: data.year || null,
    }

    await db.insert(papers).values(newPaper)

    return mapPaperRow(newPaper)
  },

  /**
   * Update an existing paper.
   * @param id - Paper ID
   * @param data - Fields to update
   */
  async update(id: string, data: UpdatePaper): Promise<Paper | undefined> {
    const updateData: Record<string, unknown> = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.authors !== undefined) updateData.authors = data.authors
    if (data.abstract !== undefined) updateData.abstract = data.abstract
    if (data.status !== undefined) updateData.status = data.status
    if (data.lastPageRead !== undefined) updateData.lastPageRead = data.lastPageRead
    if (data.tags !== undefined) updateData.tags = data.tags
    if (data.arxivId !== undefined) updateData.arxivId = data.arxivId
    if (data.doi !== undefined) updateData.doi = data.doi
    if (data.webUrl !== undefined) updateData.webUrl = data.webUrl
    if (data.pdfVaultPath !== undefined) updateData.pdfVaultPath = data.pdfVaultPath
    if (data.year !== undefined) updateData.year = data.year

    if (Object.keys(updateData).length === 0) {
      return this.findById(id)
    }

    await db.update(papers).set(updateData).where(eq(papers.id, id))
    return this.findById(id)
  },

  /**
   * Find papers by status.
   */
  async findByStatus(status: PaperStatus): Promise<Paper[]> {
    const rows = await db
      .select()
      .from(papers)
      .where(eq(papers.status, status))
      .orderBy(desc(papers.createdAt))
    return rows.map(mapPaperRow)
  },

  /**
   * Find a paper by arxiv ID.
   */
  async findByArxivId(arxivId: string): Promise<Paper | undefined> {
    const rows = await db.select().from(papers).where(eq(papers.arxivId, arxivId))
    return rows[0] ? mapPaperRow(rows[0]) : undefined
  },

  /**
   * Find a paper by DOI.
   */
  async findByDoi(doi: string): Promise<Paper | undefined> {
    const rows = await db.select().from(papers).where(eq(papers.doi, doi))
    return rows[0] ? mapPaperRow(rows[0]) : undefined
  },

  /**
   * Find papers by tag.
   */
  async findByTag(tag: string): Promise<Paper[]> {
    // Note: JSON array contains query - this is Postgres-specific
    const allPapers = await this.findAll()
    return allPapers.filter((p) => p.tags?.includes(tag))
  },
}
