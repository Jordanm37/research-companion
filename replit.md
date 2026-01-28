# Research Reader - PDF Annotation and Note-Taking Tool

## Overview

Research Reader is a web-based PDF annotation and note-taking application designed for researchers. It allows users to upload PDFs, create various types of annotations (highlights, rectangles, margin notes), organize notes by type (summary, critique, question, insight, etc.), and export everything to Obsidian-compatible markdown format. The application includes AI-powered analysis features.

## Recent Changes (January 2026)

### AI Research Assistant Feature
- Added Claude-powered research assistant for paper analysis
- Select text in PDFs to trigger a context popup with AI research actions:
  - **Find Similar Papers**: Get search suggestions for related research
  - **Explore Topic**: Deep dive into concepts and related areas
  - **Explain**: Get explanations of technical concepts and methodologies  
  - **Custom Query**: Ask any question about the selected text
- New **Research** tab in side panel showing conversation history with streaming responses
- Uses Anthropic Claude claude-sonnet-4-5 model via Replit AI integrations (billed to credits)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled using Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme variables supporting light/dark mode
- **PDF Rendering**: pdf.js library for displaying and interacting with PDF documents

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript compiled with tsx
- **API Design**: RESTful endpoints under `/api` prefix
- **File Handling**: Multer for PDF upload handling with 50MB limit
- **AI Integration**: OpenAI API for text analysis and summarization features

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all data models
- **Storage Pattern**: Currently uses in-memory storage (`MemStorage` class) with interface ready for database migration
- **Key Entities**: Papers, Annotations, Notes (NoteAtoms), Settings

### Project Structure
- `client/` - React frontend application
- `server/` - Express backend with routes, storage, and integrations
- `shared/` - Shared TypeScript types and schemas (Zod validation)
- `server/replit_integrations/` - Pre-built modules for AI chat, audio, image generation, and batch processing

### Build System
- Development: Vite dev server with HMR proxied through Express
- Production: Vite builds static assets, esbuild bundles server code
- Output: `dist/` directory with `public/` for frontend and `index.cjs` for server

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations stored in `migrations/` directory

### AI Services
- **OpenAI API**: Used for text analysis, summarization, and AI-powered note generation
- **Anthropic API**: Used for the research assistant feature (Claude claude-sonnet-4-5)
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`

### File Storage
- **Local uploads**: PDFs stored in `uploads/` directory on the server
- Files are identified by SHA-256 hash of content for deduplication

### Third-Party Libraries
- **pdf.js**: Client-side PDF rendering from Mozilla
- **Radix UI**: Accessible component primitives for the UI
- **TanStack Query**: Async state management and caching
- **Zod**: Runtime schema validation shared between client and server