/**
 * Server test setup
 * Runs before each test file
 */

import { vi, beforeEach } from 'vitest'

// Mock environment variables
process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.AI_INTEGRATIONS_OPENAI_API_KEY = 'test-openai-key'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
