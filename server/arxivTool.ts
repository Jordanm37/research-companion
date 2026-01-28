import type Anthropic from "@anthropic-ai/sdk";

const ARXIV_API_BASE = "http://export.arxiv.org/api/query";

export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  updated: string;
  pdfLink: string;
  arxivLink: string;
  categories: string[];
}

export const arxivToolDefinition: Anthropic.Tool = {
  name: "search_arxiv",
  description: "Search arXiv for academic papers. Returns paper titles, authors, abstracts, and links. Use this to find specific papers by title, author, or topic. Always include arxiv links in your responses.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query - can include author names, paper titles, keywords, or arXiv IDs"
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return (default: 5, max: 10)"
      }
    },
    required: ["query"]
  }
};

function parseArxivResponse(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];
  
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    
    const getId = (text: string) => {
      const m = text.match(/<id>([^<]+)<\/id>/);
      return m ? m[1] : "";
    };
    
    const getTitle = (text: string) => {
      const m = text.match(/<title>([^<]+)<\/title>/);
      return m ? m[1].replace(/\s+/g, " ").trim() : "";
    };
    
    const getSummary = (text: string) => {
      const m = text.match(/<summary>([\s\S]*?)<\/summary>/);
      return m ? m[1].replace(/\s+/g, " ").trim() : "";
    };
    
    const getAuthors = (text: string) => {
      const authors: string[] = [];
      const authorRegex = /<author>\s*<name>([^<]+)<\/name>/g;
      let authorMatch;
      while ((authorMatch = authorRegex.exec(text)) !== null) {
        authors.push(authorMatch[1].trim());
      }
      return authors;
    };
    
    const getDate = (text: string, tag: string) => {
      const m = text.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
      return m ? m[1] : "";
    };
    
    const getCategories = (text: string) => {
      const cats: string[] = [];
      const catRegex = /<category[^>]*term="([^"]+)"/g;
      let catMatch;
      while ((catMatch = catRegex.exec(text)) !== null) {
        cats.push(catMatch[1]);
      }
      return cats;
    };
    
    const getPdfLink = (text: string) => {
      const m = text.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
      return m ? m[1] : "";
    };
    
    const id = getId(entry);
    const arxivId = id.replace("http://arxiv.org/abs/", "").replace(/v\d+$/, "");
    
    papers.push({
      id: arxivId,
      title: getTitle(entry),
      authors: getAuthors(entry),
      summary: getSummary(entry),
      published: getDate(entry, "published"),
      updated: getDate(entry, "updated"),
      pdfLink: getPdfLink(entry) || `https://arxiv.org/pdf/${arxivId}.pdf`,
      arxivLink: `https://arxiv.org/abs/${arxivId}`,
      categories: getCategories(entry)
    });
  }
  
  return papers;
}

export async function searchArxiv(query: string, maxResults: number = 5): Promise<ArxivPaper[]> {
  const clampedMax = Math.min(Math.max(1, maxResults), 10);
  
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: "0",
    max_results: String(clampedMax),
    sortBy: "relevance",
    sortOrder: "descending"
  });
  
  try {
    const response = await fetch(`${ARXIV_API_BASE}?${params}`);
    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`);
    }
    
    const xml = await response.text();
    return parseArxivResponse(xml);
  } catch (error) {
    console.error("arXiv search error:", error);
    throw error;
  }
}

export function formatArxivResults(papers: ArxivPaper[]): string {
  if (papers.length === 0) {
    return "No papers found matching your query.";
  }
  
  return papers.map((paper, i) => {
    const authorList = paper.authors.length > 3 
      ? `${paper.authors.slice(0, 3).join(", ")} et al.`
      : paper.authors.join(", ");
    
    return `**Paper ${i + 1}: ${paper.title}**
- Authors: ${authorList}
- Published: ${paper.published.split("T")[0]}
- arXiv ID: ${paper.id}
- Link: ${paper.arxivLink}
- PDF: ${paper.pdfLink}
- Categories: ${paper.categories.join(", ")}
- Abstract: ${paper.summary.slice(0, 500)}${paper.summary.length > 500 ? "..." : ""}`;
  }).join("\n\n");
}

export async function executeArxivTool(input: { query: string; max_results?: number }): Promise<string> {
  try {
    const papers = await searchArxiv(input.query, input.max_results || 5);
    return formatArxivResults(papers);
  } catch (error) {
    return `Error searching arXiv: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
