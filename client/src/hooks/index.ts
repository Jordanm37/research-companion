// PDF viewer hooks
export { usePdfRenderer } from "./usePdfRenderer"
export type { Viewport, UsePdfRendererResult } from "./usePdfRenderer"

export { useDrawingTool } from "./useDrawingTool"
export type { ToolMode, DrawingState, UseDrawingToolResult } from "./useDrawingTool"

export { useTextSelection } from "./useTextSelection"
export type { SelectionPopupState, UseTextSelectionResult } from "./useTextSelection"

// Domain hooks
export { usePaperManagement } from "./usePaperManagement"
export type { UsePaperManagementResult } from "./usePaperManagement"

export { useAnnotations } from "./useAnnotations"
export type { UseAnnotationsResult } from "./useAnnotations"

export { useNotes } from "./useNotes"
export type { UseNotesResult } from "./useNotes"

export { useResearchChat } from "./useResearchChat"
export type {
  MatchedReference,
  ActiveToolUse,
  UseResearchChatResult,
} from "./useResearchChat"

export { useExport } from "./useExport"
export type { UseExportResult } from "./useExport"

// Re-export existing hooks
export { useToast } from "./use-toast"
