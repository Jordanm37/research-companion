/**
 * Routes Registration - Entry point for Express route configuration.
 *
 * This module provides a thin wrapper that registers the modular API router.
 * All route logic has been refactored into focused domain modules:
 *
 * - server/routes/papers.ts - Paper CRUD and PDF handling
 * - server/routes/annotations.ts - Annotation CRUD
 * - server/routes/notes.ts - Note CRUD and AI generation
 * - server/routes/researchChat.ts - Research chat with SSE streaming
 * - server/routes/export.ts - Obsidian/Markdown export
 *
 * Supporting infrastructure:
 * - server/repositories/ - Data access layer
 * - server/services/ - Domain services (PDF, export)
 * - server/ai/ - AI service (providers, prompts, tools)
 */

import type { Express } from "express"
import type { Server } from "http"
import apiRouter from "./routes/index"

/**
 * Register all API routes on the Express application.
 *
 * @param httpServer - The HTTP server instance
 * @param app - The Express application
 * @returns The HTTP server instance
 */
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Mount the API router under /api prefix
  app.use("/api", apiRouter)

  return httpServer
}
