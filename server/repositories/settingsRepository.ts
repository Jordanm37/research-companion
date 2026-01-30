/**
 * Settings Repository - Data access layer for application settings
 */

import { eq } from "drizzle-orm"
import { db } from "../db"
import { settingsTable } from "@shared/schema"
import type { Settings } from "@shared/types"
import { mapSettingsRow } from "../mappers/entityMappers"

const DEFAULT_VAULT_PATH = "/obsidian-vault"

export const settingsRepository = {
  /**
   * Get the current settings.
   * Creates default settings if none exist.
   */
  async get(): Promise<Settings> {
    const rows = await db.select().from(settingsTable)

    if (rows[0]) {
      return mapSettingsRow(rows[0])
    }

    // Create default settings if none exist
    await db.insert(settingsTable).values({
      id: 1,
      vaultPath: DEFAULT_VAULT_PATH,
    })

    return { vaultPath: DEFAULT_VAULT_PATH }
  },

  /**
   * Update settings with partial data.
   * Merges updates with current settings.
   */
  async update(updates: Partial<Settings>): Promise<Settings> {
    const current = await this.get()
    const newSettings = { ...current, ...updates }

    await db
      .update(settingsTable)
      .set({ vaultPath: newSettings.vaultPath })
      .where(eq(settingsTable.id, 1))

    return newSettings
  },
}
