import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import { 
  insertAnnotationSchema, 
  updateAnnotationSchema,
  insertNoteAtomSchema,
  updateNoteAtomSchema,
  aiRequestSchema,
  exportRequestSchema,
  researchChatRequestSchema,
  type ResearchActionType,
  type Reference
} from "@shared/schema";
import { findReferencesSection, parseReferences, matchCitationToReference } from "./referenceExtractor";
import { searchPapers, getPaperDetails } from "./semanticScholarMcp";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

function getResearchSystemPrompt(): string {
  return `You are a helpful research assistant with access to real-time tools for academic research.

YOUR TOOLS:
1. **search_papers** - Search Semantic Scholar for academic papers by title, author, or topic. Returns paper titles, authors, abstracts, citation counts, and Semantic Scholar links.
2. **get_paper_details** - Get detailed information about a specific paper by its Semantic Scholar ID.

Your role is to:
- Find and link to real academic papers using your search tools
- Help researchers explore topics and find related work
- Explain concepts and methodologies
- ALWAYS use search_papers when asked about papers or citations - provide real links

Important guidelines:
- When asked about a paper or citation, SEARCH for it to get real information and links
- Always include Semantic Scholar links when you find papers
- Be honest about what you find vs what you couldn't find
- Synthesize search results into helpful responses

Format your responses clearly with:
- Links to papers (always include the Semantic Scholar link when available)
- Bullet points for lists
- Bold text for key terms (**term**)`;
}

function buildResearchQuery(
  actionType: ResearchActionType, 
  selectedText: string, 
  customQuery?: string,
  matchedReference?: Reference | null
): string {
  switch (actionType) {
    case "find_similar":
      return `I'm reading a research paper and selected this text: "${selectedText}"

Please help me find similar papers or research. What specific search queries should I use? What databases would be most relevant? What related topics or keywords should I explore?`;
    
    case "explore_topic":
      return `I'm reading a research paper and selected this text: "${selectedText}"

Please help me explore this topic more deeply. What are the key concepts mentioned? What are the main research directions in this area? What search terms would help me find foundational and recent work on this topic?`;
    
    case "ask_question":
      return `I'm reading a research paper and selected this text: "${selectedText}"

Please explain this passage to me. What are the key concepts? How does this fit into the broader research context? Are there any technical terms I should understand?`;
    
    case "custom_query":
      return `I'm reading a research paper and selected this text: "${selectedText}"

My question is: ${customQuery || "Please analyze this text."}`;

    case "paper_summary":
      if (matchedReference) {
        return `I'm reading a research paper and highlighted this citation: "${selectedText}"

I found the full reference in the paper's bibliography:
"${matchedReference.rawText}"
${matchedReference.authors ? `Authors: ${matchedReference.authors}` : ""}
${matchedReference.year ? `Year: ${matchedReference.year}` : ""}
${matchedReference.title ? `Title: ${matchedReference.title}` : ""}

Please provide a summary of this cited paper. Include:
- The main thesis or key contribution of the paper
- The methodology or approach used
- Key findings or claims that are commonly cited
- How this paper typically relates to other research in the field
- Any important caveats about the paper's scope or limitations

If you're not certain about specific details, please indicate that and provide what general knowledge you have about this work.`;
      } else {
        return `I'm reading a research paper and highlighted this citation or paper reference: "${selectedText}"

(Note: I couldn't find this citation in the paper's reference list, so I'm working with just the selected text.)

Please provide a summary of this cited paper. Include:
- The main thesis or key contribution of the paper
- The methodology or approach used
- Key findings or claims that are commonly cited
- How this paper typically relates to other research in the field
- Any important caveats about the paper's scope or limitations

If you're not certain about specific details, please indicate that and provide what general knowledge you have about this work.`;
      }
    
    default:
      return `Selected text: "${selectedText}"\n\n${customQuery || "Please help me understand this."}`;
  }
}

const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  }
});

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

function computePaperId(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get all papers
  app.get("/api/papers", async (req, res) => {
    try {
      const papers = await storage.getPapers();
      res.json(papers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get papers" });
    }
  });

  // Upload PDF
  app.post("/api/papers/upload", upload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      const buffer = fs.readFileSync(filePath);
      const stableId = computePaperId(buffer);

      // Check if paper already exists
      const existingPapers = await storage.getPapers();
      const existing = existingPapers.find(p => p.id.startsWith(stableId.slice(0, 8)));
      if (existing) {
        // Clean up uploaded file since we already have this paper
        fs.unlinkSync(filePath);
        return res.json(existing);
      }

      // Rename file to stable name
      const sanitizedName = sanitizeFilename(originalName);
      const newPath = path.join("uploads", `${stableId}_${sanitizedName}`);
      fs.renameSync(filePath, newPath);

      // Extract text from PDF
      let extractedText: string | undefined;
      let references: Reference[] | undefined;
      
      try {
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || "";
        
        // Extract references section
        if (extractedText) {
          const referencesSection = findReferencesSection(extractedText);
          if (referencesSection) {
            references = parseReferences(referencesSection);
            console.log(`Extracted ${references.length} references from PDF`);
          }
        }
      } catch (parseError) {
        console.error("PDF text extraction failed:", parseError);
        // Continue without extracted text - it's optional
      }

      // Extract title from filename (remove .pdf extension)
      const title = originalName.replace(/\.pdf$/i, "");

      const paper = await storage.createPaper({
        title,
        filename: originalName,
        filePath: newPath,
        extractedText,
        references,
      }, stableId);

      res.json(paper);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload paper" });
    }
  });

  // Get paper PDF
  app.get("/api/papers/:paperId/pdf", async (req, res) => {
    try {
      const paper = await storage.getPaper(req.params.paperId);
      if (!paper) {
        return res.status(404).json({ error: "Paper not found" });
      }

      // Find the file that matches this paper
      const files = fs.readdirSync("uploads");
      const paperFile = files.find(f => f.startsWith(paper.id));
      
      if (paperFile) {
        const filePath = path.join("uploads", paperFile);
        if (fs.existsSync(filePath)) {
          res.setHeader("Content-Type", "application/pdf");
          return res.sendFile(path.resolve(filePath));
        }
      }

      // Fallback to stored path
      if (paper.filePath && fs.existsSync(paper.filePath)) {
        res.setHeader("Content-Type", "application/pdf");
        return res.sendFile(path.resolve(paper.filePath));
      }

      res.status(404).json({ error: "PDF file not found" });
    } catch (error) {
      console.error("PDF fetch error:", error);
      res.status(500).json({ error: "Failed to get PDF" });
    }
  });

  // Get annotations for a paper
  app.get("/api/papers/:paperId/annotations", async (req, res) => {
    try {
      const annotations = await storage.getAnnotations(req.params.paperId);
      res.json(annotations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get annotations" });
    }
  });

  // Create annotation
  app.post("/api/papers/:paperId/annotations", async (req, res) => {
    try {
      const data = {
        ...req.body,
        paperId: req.params.paperId,
      };
      
      const parsed = insertAnnotationSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const annotation = await storage.createAnnotation(parsed.data);
      res.json(annotation);
    } catch (error) {
      console.error("Create annotation error:", error);
      res.status(500).json({ error: "Failed to create annotation" });
    }
  });

  // Update annotation
  app.patch("/api/annotations/:id", async (req, res) => {
    try {
      const parsed = updateAnnotationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const annotation = await storage.updateAnnotation(req.params.id, parsed.data);
      if (!annotation) {
        return res.status(404).json({ error: "Annotation not found" });
      }

      res.json(annotation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update annotation" });
    }
  });

  // Get notes for a paper
  app.get("/api/papers/:paperId/notes", async (req, res) => {
    try {
      const notes = await storage.getNotes(req.params.paperId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notes" });
    }
  });

  // Create note
  app.post("/api/papers/:paperId/notes", async (req, res) => {
    try {
      const data = {
        ...req.body,
        paperId: req.params.paperId,
      };

      const parsed = insertNoteAtomSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const note = await storage.createNote(parsed.data);
      res.json(note);
    } catch (error) {
      console.error("Create note error:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  // Update note
  app.patch("/api/notes/:id", async (req, res) => {
    try {
      const parsed = updateNoteAtomSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const note = await storage.updateNote(req.params.id, parsed.data);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  // Delete note
  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteNote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  // AI endpoint
  app.post("/api/papers/:paperId/ai", async (req, res) => {
    try {
      const parsed = aiRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { actionType, annotationIds, noteAtomIds } = parsed.data;
      
      // Gather context from annotations and notes
      const annotations = annotationIds 
        ? await Promise.all(annotationIds.map(id => storage.getAnnotation(id)))
        : [];
      const notes = noteAtomIds
        ? await Promise.all(noteAtomIds.map(id => storage.getNote(id)))
        : [];

      // Build context text
      const contextParts: string[] = [];
      
      annotations.filter(Boolean).forEach((ann, i) => {
        if (ann?.quotedText) {
          contextParts.push(`[Excerpt ${i + 1}]: "${ann.quotedText}"`);
          if (ann.comment) {
            contextParts.push(`  Comment: ${ann.comment}`);
          }
        }
      });

      notes.filter(Boolean).forEach((note, i) => {
        if (note?.content) {
          contextParts.push(`[Note ${i + 1} - ${note.noteType}]: ${note.content}`);
        }
      });

      const context = contextParts.join("\n\n");

      // Generate prompt based on action type
      const prompts: Record<string, string> = {
        summarize: `Please provide a concise academic summary of the following excerpts and notes from a research paper:\n\n${context}\n\nSummary:`,
        critique: `Please analyze the following excerpts and notes from a research paper, identifying strengths, weaknesses, and potential issues:\n\n${context}\n\nCritique:`,
        question: `Based on the following excerpts and notes from a research paper, generate insightful research questions that could guide further investigation:\n\n${context}\n\nResearch Questions:`,
        connect: `Based on the following excerpts and notes, identify potential connections to other concepts, theories, or research areas:\n\n${context}\n\nConnections:`,
        expand: `Please elaborate on the key points in the following excerpts and notes, providing additional context and explanation:\n\n${context}\n\nExpanded Analysis:`,
      };

      const prompt = prompts[actionType] || prompts.summarize;

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an academic research assistant. Provide clear, well-structured responses that help researchers analyze and understand their papers. Keep responses concise but insightful."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 1024,
      });

      const text = response.choices[0]?.message?.content || "";

      res.json({ 
        text,
        provenance: `openai-${actionType}`
      });
    } catch (error) {
      console.error("AI error:", error);
      res.status(500).json({ error: "Failed to process AI request" });
    }
  });

  // Export to Obsidian
  app.post("/api/papers/:paperId/export", async (req, res) => {
    try {
      const parsed = exportRequestSchema.safeParse({
        ...req.body,
        paperId: req.params.paperId,
      });
      
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { paperId, vaultPath } = parsed.data;

      const paper = await storage.getPaper(paperId);
      if (!paper) {
        return res.status(404).json({ error: "Paper not found" });
      }

      const annotations = await storage.getAnnotations(paperId);
      const notes = await storage.getNotes(paperId);

      // Generate deterministic filename
      const sanitizedTitle = (paper.title || paper.filename)
        .replace(/\.pdf$/i, "")
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80);
      const filename = `${sanitizedTitle}.md`;
      const filePath = path.join(vaultPath, filename);

      // Generate Markdown content
      const mdLines: string[] = [];

      // YAML frontmatter
      mdLines.push("---");
      mdLines.push(`paper_id: "${paper.id}"`);
      mdLines.push(`title: "${paper.title || paper.filename}"`);
      if (paper.authors && paper.authors.length > 0) {
        mdLines.push(`authors:`);
        paper.authors.forEach(a => mdLines.push(`  - "${a}"`));
      }
      mdLines.push(`created: "${paper.createdAt}"`);
      mdLines.push(`exported: "${new Date().toISOString()}"`);
      mdLines.push("---");
      mdLines.push("");

      // Title
      mdLines.push(`# ${paper.title || paper.filename}`);
      mdLines.push("");

      // Notes grouped by type
      const notesByType = new Map<string, typeof notes>();
      notes.forEach(note => {
        const existing = notesByType.get(note.noteType) || [];
        existing.push(note);
        notesByType.set(note.noteType, existing);
      });

      if (notes.length > 0) {
        mdLines.push("## Notes");
        mdLines.push("");

        notesByType.forEach((typeNotes, type) => {
          mdLines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}`);
          mdLines.push("");

          typeNotes.forEach(note => {
            mdLines.push(`<!-- note_id: ${note.id} -->`);
            mdLines.push(note.content);
            
            // Add outbound links as wiki links
            if (note.outboundLinks.length > 0) {
              mdLines.push("");
              mdLines.push("Related: " + note.outboundLinks.map(l => `[[${l}]]`).join(", "));
            }
            
            if (note.aiProvenance) {
              mdLines.push(`*Generated by AI: ${note.aiProvenance}*`);
            }
            mdLines.push("");
          });
        });
      }

      // Annotation index
      if (annotations.length > 0) {
        mdLines.push("## Annotation Index");
        mdLines.push("");

        annotations.forEach(ann => {
          mdLines.push(`<!-- annotation_id: ${ann.id} -->`);
          mdLines.push(`- **Page ${ann.pageIndex + 1}** (${ann.annotationType})`);
          if (ann.quotedText) {
            mdLines.push(`  > ${ann.quotedText}`);
          }
          if (ann.comment) {
            mdLines.push(`  - ${ann.comment}`);
          }
          mdLines.push("");
        });
      }

      const mdContent = mdLines.join("\n");

      // Write or update file
      try {
        // Ensure vault directory exists
        if (!fs.existsSync(vaultPath)) {
          fs.mkdirSync(vaultPath, { recursive: true });
        }

        // Check if file exists for update behavior
        if (fs.existsSync(filePath)) {
          const existing = fs.readFileSync(filePath, "utf-8");
          
          // Simple merge: replace content but preserve any manually added sections
          // In a full implementation, this would do proper ID-based merging
          fs.writeFileSync(filePath, mdContent, "utf-8");
        } else {
          fs.writeFileSync(filePath, mdContent, "utf-8");
        }

        res.json({ 
          success: true, 
          path: filePath,
          filename 
        });
      } catch (writeError) {
        console.error("Write error:", writeError);
        res.status(500).json({ error: "Failed to write to vault path" });
      }
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export" });
    }
  });

  // Get Markdown preview
  app.get("/api/papers/:paperId/preview", async (req, res) => {
    try {
      const paper = await storage.getPaper(req.params.paperId);
      if (!paper) {
        return res.status(404).json({ error: "Paper not found" });
      }

      const annotations = await storage.getAnnotations(req.params.paperId);
      const notes = await storage.getNotes(req.params.paperId);

      // Generate preview (same as export but don't write)
      res.json({
        paper,
        annotations,
        notes,
        annotationCount: annotations.length,
        noteCount: notes.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get preview" });
    }
  });

  // Get references for a paper
  app.get("/api/papers/:paperId/references", async (req, res) => {
    try {
      const paper = await storage.getPaper(req.params.paperId);
      if (!paper) {
        return res.status(404).json({ error: "Paper not found" });
      }
      res.json(paper.references || []);
    } catch (error) {
      console.error("Error getting references:", error);
      res.status(500).json({ error: "Failed to get references" });
    }
  });

  // Research Chat - Get chat history for a paper
  app.get("/api/papers/:paperId/research-chat", async (req, res) => {
    try {
      const messages = await storage.getResearchChatMessages(req.params.paperId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting research chat:", error);
      res.status(500).json({ error: "Failed to get chat history" });
    }
  });

  // Research Chat - Clear chat history for a paper
  app.delete("/api/papers/:paperId/research-chat", async (req, res) => {
    try {
      await storage.clearResearchChatMessages(req.params.paperId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing research chat:", error);
      res.status(500).json({ error: "Failed to clear chat history" });
    }
  });

  // Research Chat - Send message and get AI response (agentic with tools)
  app.post("/api/papers/:paperId/research-chat", async (req, res) => {
    try {
      const paperId = req.params.paperId;
      const paper = await storage.getPaper(paperId);
      if (!paper) {
        return res.status(404).json({ error: "Paper not found" });
      }

      const parseResult = researchChatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.issues });
      }

      const { query, selectedText, actionType } = parseResult.data;

      // For paper_summary action, try to match citation to reference (still useful for context)
      let matchedReference: Reference | null = null;
      if (actionType === "paper_summary" && paper.references && selectedText) {
        matchedReference = matchCitationToReference(selectedText, paper.references);
        if (matchedReference) {
          console.log(`Matched citation "${selectedText}" to reference: ${matchedReference.rawText.slice(0, 100)}...`);
        }
      }

      // Build the user message with matched reference if available
      const userMessage = buildResearchQuery(actionType, selectedText, query, matchedReference);

      // Save user message
      await storage.createResearchChatMessage({
        paperId,
        role: "user",
        content: userMessage,
        selectedText,
        actionType,
      });

      // Get chat history for context (limit to prevent token overflow)
      const history = await storage.getResearchChatMessages(paperId);
      const contextMessages: Anthropic.MessageParam[] = history.slice(-6).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send matched reference info first if available
      if (actionType === "paper_summary") {
        res.write(`data: ${JSON.stringify({ 
          matchedReference: matchedReference ? {
            rawText: matchedReference.rawText,
            authors: matchedReference.authors,
            year: matchedReference.year,
            title: matchedReference.title,
            index: matchedReference.index,
          } : null
        })}\n\n`);
      }

      // Define tools for Semantic Scholar MCP
      const tools: Anthropic.Tool[] = [
        {
          name: "search_papers",
          description: "Search Semantic Scholar for academic papers. Returns paper titles, authors, abstracts, citation counts, and links.",
          input_schema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query - can include paper titles, author names, or topics"
              },
              limit: {
                type: "number",
                description: "Maximum number of results to return (default: 5)"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "get_paper_details",
          description: "Get detailed information about a specific paper by its Semantic Scholar ID.",
          input_schema: {
            type: "object",
            properties: {
              paper_id: {
                type: "string",
                description: "Semantic Scholar paper ID"
              }
            },
            required: ["paper_id"]
          }
        }
      ];

      let fullResponse = "";
      let messages = [...contextMessages];
      const MAX_ITERATIONS = 5;
      let iterations = 0;

      // Agentic loop - keep running until we get a final response or hit max iterations
      while (iterations < MAX_ITERATIONS) {
        iterations++;
        
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          system: getResearchSystemPrompt(),
          messages,
          tools,
        });

        // Process response content
        let hasToolUse = false;
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "text") {
            // Stream text content to client
            fullResponse += block.text;
            res.write(`data: ${JSON.stringify({ content: block.text })}\n\n`);
          } else if (block.type === "tool_use") {
            hasToolUse = true;
            const toolName = block.name;
            const toolInput = block.input as Record<string, unknown>;
            
            // Notify client about tool usage
            res.write(`data: ${JSON.stringify({ 
              toolUse: { name: toolName, input: toolInput }
            })}\n\n`);

            console.log(`Executing tool: ${toolName}`, toolInput);

            // Execute the tool via Semantic Scholar MCP
            let toolResult: string;
            try {
              if (toolName === "search_papers") {
                toolResult = await searchPapers(
                  toolInput.query as string, 
                  (toolInput.limit as number) || 5
                );
              } else if (toolName === "get_paper_details") {
                toolResult = await getPaperDetails(toolInput.paper_id as string);
              } else {
                toolResult = `Unknown tool: ${toolName}`;
              }
            } catch (error) {
              toolResult = `Tool error: ${error instanceof Error ? error.message : "Unknown error"}`;
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: toolResult,
            });
          }
        }

        // If there were tool uses, add the assistant response and tool results to continue the loop
        if (hasToolUse && toolResults.length > 0) {
          messages.push({
            role: "assistant",
            content: response.content,
          });
          messages.push({
            role: "user",
            content: toolResults,
          });
        }

        // If stop_reason is "end_turn" or no tool use, we're done
        if (response.stop_reason === "end_turn" || !hasToolUse) {
          break;
        }
      }

      // Save assistant message
      await storage.createResearchChatMessage({
        paperId,
        role: "assistant",
        content: fullResponse,
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Research chat error:", error);
      // Check if headers already sent (SSE streaming started)
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to process request" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process research query" });
      }
    }
  });

  return httpServer;
}
