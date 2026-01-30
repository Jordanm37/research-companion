/**
 * Unit tests for ingestionService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ingestionService } from './ingestionService'

// Mock the dependencies
vi.mock('../repositories/paperRepository', () => ({
  paperRepository: {
    findByArxivId: vi.fn(),
    create: vi.fn((data) => ({ id: 'test-id', ...data })),
  },
}))

vi.mock('./pdfService', () => ({
  pdfService: {
    extractTextAndReferences: vi.fn().mockResolvedValue({
      extractedText: 'Test extracted text',
      references: [],
    }),
  },
}))

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('PDF content')),
}))

describe('ingestionService.parseArxivUrl', () => {
  it('parses standard arxiv abstract URL', () => {
    const result = ingestionService.parseArxivUrl('https://arxiv.org/abs/2301.00001')
    expect(result).toBe('2301.00001')
  })

  it('parses arxiv abstract URL with version', () => {
    const result = ingestionService.parseArxivUrl('https://arxiv.org/abs/2301.00001v2')
    expect(result).toBe('2301.00001v2')
  })

  it('parses arxiv PDF URL', () => {
    const result = ingestionService.parseArxivUrl('https://arxiv.org/pdf/2301.00001.pdf')
    expect(result).toBe('2301.00001')
  })

  it('parses arxiv PDF URL without .pdf extension', () => {
    const result = ingestionService.parseArxivUrl('https://arxiv.org/pdf/2301.00001')
    expect(result).toBe('2301.00001')
  })

  it('parses export.arxiv.org URL', () => {
    const result = ingestionService.parseArxivUrl('https://export.arxiv.org/abs/2301.00001')
    expect(result).toBe('2301.00001')
  })

  it('parses arxiv: shorthand', () => {
    const result = ingestionService.parseArxivUrl('arxiv:2301.00001')
    expect(result).toBe('2301.00001')
  })

  it('parses old-format arxiv ID (hep-ph)', () => {
    const result = ingestionService.parseArxivUrl('https://arxiv.org/abs/hep-ph/0001234')
    expect(result).toBe('hep-ph/0001234')
  })

  it('returns null for non-arxiv URL', () => {
    const result = ingestionService.parseArxivUrl('https://example.com/paper.pdf')
    expect(result).toBeNull()
  })

  it('returns null for invalid URL', () => {
    const result = ingestionService.parseArxivUrl('not-a-url')
    expect(result).toBeNull()
  })

  it('handles URL with query parameters', () => {
    const result = ingestionService.parseArxivUrl('https://arxiv.org/abs/2301.00001?context=cs')
    expect(result).toBe('2301.00001')
  })
})

describe('ingestionService.ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock global fetch
    global.fetch = vi.fn()
  })

  it('routes arxiv.org URLs to ingestFromArxiv', async () => {
    // Mock the arxiv API response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(`
        <feed>
          <entry>
            <title>Test Paper Title</title>
            <author><name>Test Author</name></author>
            <summary>Test abstract</summary>
            <published>2023-01-01T00:00:00Z</published>
          </entry>
        </feed>
      `),
    }).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })

    // Mock paperRepository.findByArxivId to return null (not exists)
    const { paperRepository } = await import('../repositories/paperRepository')
    ;(paperRepository.findByArxivId as any).mockResolvedValue(null)

    const result = await ingestionService.ingest('https://arxiv.org/abs/2301.00001')

    expect(result.success).toBe(true)
    expect(result.paper).toBeDefined()
  })

  it('routes direct PDF URLs to ingestFromPdfUrl', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })

    const result = await ingestionService.ingest('https://example.com/paper.pdf')

    expect(result.success).toBe(true)
    expect(result.paper).toBeDefined()
  })

  it('returns error for unsupported URL format', async () => {
    const result = await ingestionService.ingest('https://example.com/not-a-paper')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported URL format')
  })

  it('trims whitespace from URL', async () => {
    const result = await ingestionService.ingest('  https://example.com/not-a-paper  ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported URL format')
  })
})

describe('ingestionService error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('handles arxiv API failure', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const { paperRepository } = await import('../repositories/paperRepository')
    ;(paperRepository.findByArxivId as any).mockResolvedValue(null)

    const result = await ingestionService.ingestFromArxiv('https://arxiv.org/abs/2301.00001')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to fetch arxiv metadata')
  })

  it('handles PDF download failure', async () => {
    // Mock arxiv API success
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(`
        <feed>
          <entry>
            <title>Test Paper</title>
            <author><name>Author</name></author>
            <summary>Abstract</summary>
            <published>2023-01-01T00:00:00Z</published>
          </entry>
        </feed>
      `),
    }).mockResolvedValueOnce({
      // PDF download fails
      ok: false,
      status: 404,
    })

    const { paperRepository } = await import('../repositories/paperRepository')
    ;(paperRepository.findByArxivId as any).mockResolvedValue(null)

    const result = await ingestionService.ingestFromArxiv('https://arxiv.org/abs/2301.00001')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to download PDF')
  })

  it('returns existing paper if already ingested', async () => {
    const existingPaper = { id: 'existing', title: 'Already ingested', arxivId: '2301.00001' }

    const { paperRepository } = await import('../repositories/paperRepository')
    ;(paperRepository.findByArxivId as any).mockResolvedValue(existingPaper)

    const result = await ingestionService.ingestFromArxiv('https://arxiv.org/abs/2301.00001')

    expect(result.success).toBe(true)
    expect(result.alreadyExists).toBe(true)
    expect(result.paper).toEqual(existingPaper)
  })
})
