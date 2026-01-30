/**
 * Repository Layer - Barrel exports
 *
 * This module provides clean data access patterns for the application.
 * Each repository handles a single entity type and encapsulates all
 * database operations for that entity.
 */

export { paperRepository } from "./paperRepository"
export { annotationRepository } from "./annotationRepository"
export { noteRepository } from "./noteRepository"
export { chatRepository } from "./chatRepository"
export { settingsRepository } from "./settingsRepository"
