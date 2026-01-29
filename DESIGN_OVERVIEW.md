# Research Reader - Design Overview

## Vision & Purpose

Research Reader is a focused tool for researchers who need to deeply engage with academic PDFs. The core goal is to bridge the gap between reading, annotating, thinking, and writing—all in one workflow that exports cleanly to Obsidian for long-term knowledge management.

### Target User
A researcher (academic, independent, or professional) who:
- Reads many PDFs and needs to capture insights systematically
- Wants AI assistance to accelerate understanding and exploration
- Uses Obsidian (or similar) for their knowledge base
- Values a streamlined, distraction-free reading experience

### Core Value Proposition
1. **Read PDFs** with a clean, focused interface
2. **Annotate** with highlights and region selections (for figures/tables)
3. **Generate structured notes** from annotations using AI or manual input
4. **Research deeper** by asking AI questions about selected text, finding related papers
5. **Export to Obsidian** with proper markdown formatting and linked references

---

## Current System Architecture

### Two Distinct AI-Powered Workflows

**1. Notes System (Annotations → Notes)**
- User creates annotations (highlights, rectangles, margin notes)
- User selects annotations in the Annotations tab
- User triggers AI actions in the Notes tab (Summarize, Critique, Question, Connect, Expand)
- AI generates a "note atom" linked to the selected annotations
- Notes are typed (summary, critique, question, insight, methodology, finding, connection, custom)

**2. Research Chat System (Text Selection → AI Conversation)**
- User selects text directly in PDF (separate from annotation tool)
- Context popup appears with AI actions (Find Similar Papers, Explore Topic, Explain, Summarize Cited Paper, Custom Query)
- Research Chat panel shows streaming AI response
- User can send follow-up questions to continue the conversation
- Uses Claude with Semantic Scholar MCP for real paper searches

### Key Technical Components
- **PDF Viewer**: pdf.js with custom text layer for selection
- **Storage**: PostgreSQL with Drizzle ORM (papers, annotations, notes, chat messages)
- **AI Services**: OpenAI for note generation, Anthropic Claude for research chat
- **MCP Integration**: Semantic Scholar via Smithery-hosted server for paper search

---

## Design Ambiguities & Concerns

### 1. Two Overlapping Selection Paradigms
**Problem**: There are two ways to "select" content in the PDF:
- **Text selection** (in select mode) → triggers Research Chat popup
- **Drawing annotations** (highlight/rectangle tools) → creates stored annotations

**Confusion**: Users may not understand why selecting text sometimes creates annotations and sometimes opens AI chat. The mental model is split.

**Possible resolution**: Unify into one selection model where any text selection offers all options (highlight, create note, ask AI) in a single context menu.

### 2. Annotation → Note Flow is Multi-Step
**Problem**: Creating an AI-powered note requires:
1. Create annotation(s) with drawing tools
2. Switch to Annotations tab
3. Check the annotation(s) to select them
4. Switch to Notes tab
5. Click an AI action button
6. Review and confirm the generated note

**Confusion**: Too many steps, tab switching breaks flow. Users may not discover this workflow.

**Possible resolution**: Add note creation directly on annotation cards in the sidebar. When you highlight something, the annotation card immediately has options to create a note.

### 3. "Connect" Action is Unclear
**Problem**: The "Connect" AI action in the Notes system is meant to find thematic connections between selected annotations, but:
- The name is vague
- Users don't know when to use it vs. other actions
- It requires multiple annotations selected to be meaningful

**Possible resolution**: Rename to "Compare & Relate" or remove entirely if not adding clear value. Could be replaced with explicit "How does X relate to Y?" prompts.

### 4. Research Chat Context Leaks into Follow-ups
**Bug identified**: Follow-up messages in Research Chat still include the "I'm reading a research paper and selected this text..." prefix, which should only appear on initial actions from the context menu.

**Fix needed**: The follow-up handler should send messages without the research context prefix.

### 5. AI Cannot See Full PDF
**Limitation**: The AI only sees the specific text the user selects. It cannot:
- Reference other parts of the paper
- Understand the full context of a section
- Answer questions about figures/tables (only text)

**Possible enhancement**: Add a tool that gives the AI access to the full extracted PDF text, allowing it to search and reference any part of the paper.

### 6. Margin Notes are Orphaned
**Problem**: Margin notes are a distinct annotation type but they don't have clear placement or visual representation in the PDF viewer. They exist in the data model but may not be visible inline.

**Possible resolution**: Display margin notes as icons in the PDF margin that expand on hover/click.

### 7. Export to Obsidian is Underdeveloped
**Current state**: Export functionality exists but may not be prominently featured or tested with real Obsidian workflows.

**Concerns**:
- Are notes properly linked to paper references?
- Is the markdown format compatible with Obsidian conventions?
- Can users customize the export template?

---

## Proposed Simplified UX

### Single Selection Mode
- Highlight text in PDF → context menu appears
- Context menu options:
  - **Highlight** (saves as annotation with chosen color)
  - **Quick Note** (text input right there)
  - **Ask AI** (opens Research Chat with this text)
  - **Create Note** → submenu with note types (Summary, Critique, Question, Insight)

### Rectangle Tool for Figures
- Separate tool for boxing figures/tables/diagrams
- Creates annotation that can be referenced in notes
- Could potentially send to vision AI in future

### Annotation Cards with Inline Actions
- Each annotation card in sidebar shows:
  - The highlighted text or region preview
  - Quick note text input
  - Dropdown for AI-generated note type
  - "Generate Note" button
- No need to switch tabs or multi-select

### Persistent Research Chat
- Already implemented as a tab
- Consider: floating/overlay option so user doesn't lose PDF context?

---

## Technical Debt & Blockers

### 1. Text Layer Positioning
- Text selection coordinates require careful calculation (viewport transforms)
- Edge cases with multi-column PDFs, rotated pages, or unusual layouts

### 2. Annotation Coordinate Systems
- Annotations store normalized coordinates (0-1 range)
- Must handle zoom, scroll, and resize correctly
- Potential bugs with bounding box calculations across different PDF renderers

### 3. Streaming Response Handling
- Both OpenAI and Anthropic endpoints use SSE streaming
- Error handling and reconnection logic may need hardening
- UI state management during streaming is complex

### 4. Database Schema Evolution
- Current schema works but may need refactoring for:
  - Multiple papers in a "project" or "collection"
  - Sharing/collaboration features
  - Version history for annotations

### 5. MCP Server Reliability
- Semantic Scholar MCP is hosted externally (Smithery)
- Dependency on third-party uptime
- Need fallback behavior if MCP server is unavailable

---

## Future Considerations

1. **Multi-paper projects**: Group related papers, see annotations across papers
2. **Citation graph**: Visualize connections between cited papers
3. **PDF OCR**: Handle scanned PDFs without text layers
4. **Figure extraction**: AI analysis of charts, diagrams, tables
5. **Collaborative annotations**: Share annotations with research group
6. **Mobile/tablet support**: Touch-friendly annotation on iPad

---

## Summary

Research Reader has a solid foundation with PDF viewing, annotation, AI-powered notes, and research chat. The main UX challenge is the split between two annotation/selection paradigms and the multi-step note creation flow. Simplifying to a unified context menu approach and adding inline note creation on annotation cards would significantly improve usability.

The research chat with follow-up questions and Semantic Scholar integration is a strong differentiator. Giving the AI access to the full PDF text would make it even more powerful.

Priority fixes:
1. Fix follow-up message context prefix bug
2. Simplify annotation → note flow
3. Clarify or remove "Connect" action
4. Consider unified selection context menu
