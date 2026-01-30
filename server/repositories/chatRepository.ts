/**
 * Chat Repository - Data access layer for research chat messages
 */

import { randomUUID } from "crypto"
import { eq, asc } from "drizzle-orm"
import { db } from "../db"
import { researchChatMessagesTable } from "@shared/schema"
import type { ResearchChatMessage, InsertResearchChatMessage } from "@shared/types"
import { mapChatMessageRow } from "../mappers/entityMappers"

export const chatRepository = {
  /**
   * Find all chat messages for a paper, ordered by creation date.
   */
  async findByPaperId(paperId: string): Promise<ResearchChatMessage[]> {
    const rows = await db
      .select()
      .from(researchChatMessagesTable)
      .where(eq(researchChatMessagesTable.paperId, paperId))
      .orderBy(asc(researchChatMessagesTable.createdAt))

    return rows.map(mapChatMessageRow)
  },

  /**
   * Create a new chat message.
   */
  async create(data: InsertResearchChatMessage): Promise<ResearchChatMessage> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const newMessage = {
      id,
      paperId: data.paperId,
      role: data.role,
      content: data.content,
      selectedText: data.selectedText || null,
      actionType: data.actionType || null,
      createdAt: now,
    }

    await db.insert(researchChatMessagesTable).values(newMessage)

    return mapChatMessageRow(newMessage)
  },

  /**
   * Clear all chat messages for a paper.
   */
  async clearByPaperId(paperId: string): Promise<void> {
    await db
      .delete(researchChatMessagesTable)
      .where(eq(researchChatMessagesTable.paperId, paperId))
  },
}
