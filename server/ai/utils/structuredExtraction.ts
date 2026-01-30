/**
 * Structured Extraction for Tool Results
 *
 * Parses raw tool output into structured data, preserving key information
 * while reducing token count significantly.
 */

export interface ExtractedPaper {
  title: string
  authors: string
  year?: string
  citationCount?: number
  abstract?: string
  url?: string
  paperId?: string
}

export interface StructuredSearchResult {
  papers: ExtractedPaper[]
  totalFound?: number
  query?: string
}

/**
 * Extract structured paper data from Semantic Scholar search results.
 * Handles various output formats from the MCP server.
 */
export function extractPapersFromSearchResult(rawResult: string): StructuredSearchResult {
  const papers: ExtractedPaper[] = []

  // Try to parse as JSON first (some MCP servers return JSON)
  try {
    const parsed = JSON.parse(rawResult)
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        papers.push(extractPaperFromObject(item))
      }
      return { papers }
    }
    if (parsed.data && Array.isArray(parsed.data)) {
      for (const item of parsed.data) {
        papers.push(extractPaperFromObject(item))
      }
      return { papers, totalFound: parsed.total }
    }
  } catch {
    // Not JSON, parse as text
  }

  // Parse markdown/text format
  const lines = rawResult.split('\n')
  let currentPaper: Partial<ExtractedPaper> = {}

  for (const line of lines) {
    const trimmed = line.trim()

    // New paper header (## Paper 1: Title or **Title:** or 1. Title)
    if (trimmed.match(/^##\s*Paper\s*\d+/i) || trimmed.match(/^\d+\.\s+\*\*/)) {
      if (currentPaper.title) {
        papers.push(currentPaper as ExtractedPaper)
      }
      currentPaper = {}
      // Extract title from header
      const titleMatch = trimmed.match(/(?:Paper\s*\d+[:\s]*|^\d+\.\s*\*\*)(.*?)(?:\*\*)?$/i)
      if (titleMatch) {
        currentPaper.title = titleMatch[1].replace(/\*\*/g, '').trim()
      }
    }

    // Title line
    if (trimmed.match(/^\*?\*?Title[:\s]/i)) {
      currentPaper.title = trimmed.replace(/^\*?\*?Title[:\s]*/i, '').replace(/\*\*/g, '').trim()
    }

    // Authors line
    if (trimmed.match(/^\*?\*?Authors?[:\s]/i)) {
      currentPaper.authors = trimmed.replace(/^\*?\*?Authors?[:\s]*/i, '').replace(/\*\*/g, '').trim()
    }

    // Year line
    if (trimmed.match(/^\*?\*?Year[:\s]/i)) {
      const yearMatch = trimmed.match(/(\d{4})/)
      if (yearMatch) {
        currentPaper.year = yearMatch[1]
      }
    }

    // Citation count
    if (trimmed.match(/^\*?\*?Citations?[:\s]/i)) {
      const countMatch = trimmed.match(/(\d+)/)
      if (countMatch) {
        currentPaper.citationCount = parseInt(countMatch[1], 10)
      }
    }

    // URL/Link
    if (trimmed.match(/^\*?\*?(?:URL|Link|Semantic Scholar)[:\s]/i)) {
      const urlMatch = trimmed.match(/(https?:\/\/[^\s)]+)/)
      if (urlMatch) {
        currentPaper.url = urlMatch[1]
      }
    }

    // Abstract (can be multi-line, so just grab first line)
    if (trimmed.match(/^\*?\*?Abstract[:\s]/i)) {
      currentPaper.abstract = trimmed.replace(/^\*?\*?Abstract[:\s]*/i, '').replace(/\*\*/g, '').trim()
    }

    // Paper ID
    if (trimmed.match(/^\*?\*?(?:Paper\s*)?ID[:\s]/i)) {
      currentPaper.paperId = trimmed.replace(/^\*?\*?(?:Paper\s*)?ID[:\s]*/i, '').trim()
    }
  }

  // Don't forget the last paper
  if (currentPaper.title) {
    papers.push(currentPaper as ExtractedPaper)
  }

  return { papers }
}

/**
 * Extract paper data from a JSON object.
 */
function extractPaperFromObject(obj: Record<string, unknown>): ExtractedPaper {
  return {
    title: String(obj.title || obj.name || 'Unknown'),
    authors: Array.isArray(obj.authors)
      ? obj.authors.map((a: any) => a.name || a).join(', ')
      : String(obj.authors || ''),
    year: obj.year ? String(obj.year) : undefined,
    citationCount: typeof obj.citationCount === 'number' ? obj.citationCount : undefined,
    abstract: obj.abstract ? String(obj.abstract).slice(0, 500) : undefined,
    url: obj.url || obj.link ? String(obj.url || obj.link) : undefined,
    paperId: obj.paperId || obj.id ? String(obj.paperId || obj.id) : undefined,
  }
}

/**
 * Format extracted papers back into a concise, readable format.
 * This is what gets sent to the LLM - much more token-efficient.
 */
export function formatExtractedPapers(
  result: StructuredSearchResult,
  options: { maxPapers?: number; includeAbstract?: boolean } = {}
): string {
  const { maxPapers = 10, includeAbstract = true } = options

  if (result.papers.length === 0) {
    return 'No papers found matching the search query.'
  }

  const lines: string[] = []

  if (result.totalFound) {
    lines.push(`Found ${result.totalFound} papers. Showing top ${Math.min(result.papers.length, maxPapers)}:\n`)
  }

  const papersToShow = result.papers.slice(0, maxPapers)

  for (let i = 0; i < papersToShow.length; i++) {
    const p = papersToShow[i]
    lines.push(`**${i + 1}. ${p.title}**`)

    if (p.authors) {
      lines.push(`   Authors: ${p.authors}`)
    }

    const meta: string[] = []
    if (p.year) meta.push(`Year: ${p.year}`)
    if (p.citationCount !== undefined) meta.push(`Citations: ${p.citationCount}`)
    if (meta.length > 0) {
      lines.push(`   ${meta.join(' | ')}`)
    }

    if (includeAbstract && p.abstract) {
      // Truncate abstract to ~200 chars for efficiency
      const abstractPreview = p.abstract.length > 200
        ? p.abstract.slice(0, 200) + '...'
        : p.abstract
      lines.push(`   Abstract: ${abstractPreview}`)
    }

    if (p.url) {
      lines.push(`   Link: ${p.url}`)
    }

    lines.push('') // Blank line between papers
  }

  if (result.papers.length > maxPapers) {
    lines.push(`... and ${result.papers.length - maxPapers} more results.`)
  }

  return lines.join('\n')
}

/**
 * Process a raw tool result into a structured, token-efficient format.
 * Returns the original if extraction fails or isn't applicable.
 */
export function processToolResult(toolName: string, rawResult: string): string {
  // Only process search results
  if (toolName !== 'search_papers') {
    return rawResult
  }

  // Check if it's an error message
  if (
    rawResult.toLowerCase().includes('error') ||
    rawResult.toLowerCase().includes('unavailable') ||
    rawResult.length < 100
  ) {
    return rawResult
  }

  try {
    const extracted = extractPapersFromSearchResult(rawResult)

    // If we couldn't extract any papers, return original
    if (extracted.papers.length === 0) {
      return rawResult
    }

    const formatted = formatExtractedPapers(extracted, {
      maxPapers: 10,
      includeAbstract: true,
    })

    // Log the compression ratio
    const originalTokens = Math.ceil(rawResult.length / 3.5)
    const newTokens = Math.ceil(formatted.length / 3.5)
    if (newTokens < originalTokens * 0.8) {
      console.log(
        `Structured extraction: ${originalTokens} -> ${newTokens} tokens (${Math.round((1 - newTokens / originalTokens) * 100)}% reduction)`
      )
    }

    return formatted
  } catch (error) {
    console.error('Structured extraction failed:', error)
    return rawResult
  }
}
