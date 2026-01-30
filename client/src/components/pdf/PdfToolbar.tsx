import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Highlighter,
  Square,
  StickyNote,
} from "lucide-react";
import type { ToolMode } from "@/hooks/useDrawingTool";

interface PdfToolbarProps {
  // Page navigation
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  // Zoom controls
  scale: number;
  minScale?: number;
  maxScale?: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  // Tool mode
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
}

/**
 * PDF viewer toolbar with navigation, zoom, and annotation tool controls.
 */
export function PdfToolbar({
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  scale,
  minScale = 0.5,
  maxScale = 3,
  onZoomIn,
  onZoomOut,
  toolMode,
  onToolModeChange,
}: PdfToolbarProps) {
  const handleToolToggle = (mode: ToolMode) => {
    onToolModeChange(toolMode === mode ? "select" : mode);
  };

  return (
    <div className="flex items-center justify-between p-2 border-b bg-card gap-2 flex-wrap">
      {/* Page Navigation */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onPreviousPage}
              disabled={currentPage <= 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous Page</TooltipContent>
        </Tooltip>

        <span
          className="text-sm px-2 min-w-[80px] text-center"
          data-testid="text-page-number"
        >
          {currentPage} / {totalPages}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next Page</TooltipContent>
        </Tooltip>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onZoomOut}
              disabled={scale <= minScale}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <span
          className="text-sm px-2 min-w-[50px] text-center"
          data-testid="text-zoom-level"
        >
          {Math.round(scale * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onZoomIn}
              disabled={scale >= maxScale}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>
      </div>

      {/* Annotation Tools */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={toolMode === "highlight" ? "default" : "ghost"}
              onClick={() => handleToolToggle("highlight")}
              data-testid="button-tool-highlight"
            >
              <Highlighter className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Highlight Text</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={toolMode === "rectangle" ? "default" : "ghost"}
              onClick={() => handleToolToggle("rectangle")}
              data-testid="button-tool-rectangle"
            >
              <Square className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Draw Rectangle</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={toolMode === "margin_note" ? "default" : "ghost"}
              onClick={() => handleToolToggle("margin_note")}
              data-testid="button-tool-margin-note"
            >
              <StickyNote className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Margin Note</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default PdfToolbar;
