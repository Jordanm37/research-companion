import { useState, useCallback } from "react";
import type { BoundingBox, AnnotationType } from "@shared/schema";
import type { Viewport } from "./usePdfRenderer";

export type ToolMode = "select" | "highlight" | "rectangle" | "margin_note";

export interface DrawingState {
  isSelecting: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionRect: BoundingBox | null;
}

export interface UseDrawingToolResult {
  toolMode: ToolMode;
  drawingState: DrawingState;
  setToolMode: (mode: ToolMode) => void;
  toggleToolMode: (mode: ToolMode) => void;
  handleMouseDown: (e: React.MouseEvent, canvasRect: DOMRect | null) => void;
  handleMouseMove: (e: React.MouseEvent, canvasRect: DOMRect | null) => void;
  handleMouseUp: (
    viewport: Viewport | null,
    currentPage: number,
    onCreateAnnotation: (
      pageIndex: number,
      boundingBox: BoundingBox,
      annotationType: AnnotationType,
      quotedText?: string
    ) => void,
    textLayerRef?: React.RefObject<HTMLDivElement>
  ) => void;
  resetDrawing: () => void;
}

/**
 * Extract text from text layer spans that overlap with the given selection rectangle.
 * Spans are positioned absolutely with left/top in pixels.
 */
function extractTextFromSelection(
  textLayer: HTMLDivElement,
  selectionRect: BoundingBox,
  viewport: Viewport
): string {
  const spans = textLayer.querySelectorAll("span");
  const overlappingTexts: { text: string; left: number; top: number }[] = [];

  spans.forEach((span) => {
    const spanRect = span.getBoundingClientRect();
    const layerRect = textLayer.getBoundingClientRect();

    // Get span position relative to text layer
    const spanLeft = spanRect.left - layerRect.left;
    const spanTop = spanRect.top - layerRect.top;
    const spanRight = spanLeft + spanRect.width;
    const spanBottom = spanTop + spanRect.height;

    // Selection rectangle bounds
    const selLeft = selectionRect.x;
    const selTop = selectionRect.y;
    const selRight = selectionRect.x + selectionRect.width;
    const selBottom = selectionRect.y + selectionRect.height;

    // Check overlap (with some tolerance)
    const overlap =
      spanLeft < selRight &&
      spanRight > selLeft &&
      spanTop < selBottom &&
      spanBottom > selTop;

    if (overlap && span.textContent) {
      overlappingTexts.push({
        text: span.textContent,
        left: spanLeft,
        top: spanTop,
      });
    }
  });

  // Sort by position (top to bottom, left to right) and join
  overlappingTexts.sort((a, b) => {
    const rowDiff = Math.round(a.top / 10) - Math.round(b.top / 10); // Group by ~10px rows
    if (rowDiff !== 0) return rowDiff;
    return a.left - b.left;
  });

  return overlappingTexts.map((t) => t.text).join(" ").trim();
}

const initialDrawingState: DrawingState = {
  isSelecting: false,
  selectionStart: null,
  selectionRect: null,
};

export function useDrawingTool(): UseDrawingToolResult {
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [drawingState, setDrawingState] = useState<DrawingState>(initialDrawingState);

  const toggleToolMode = useCallback((mode: ToolMode) => {
    setToolMode((current) => (current === mode ? "select" : mode));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, canvasRect: DOMRect | null) => {
    if (toolMode === "select" || !canvasRect) return;

    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

    setDrawingState({
      isSelecting: true,
      selectionStart: { x, y },
      selectionRect: { x, y, width: 0, height: 0 },
    });
  }, [toolMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent, canvasRect: DOMRect | null) => {
    setDrawingState((current) => {
      if (!current.isSelecting || !current.selectionStart || !canvasRect) {
        return current;
      }

      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;

      return {
        ...current,
        selectionRect: {
          x: Math.min(current.selectionStart.x, x),
          y: Math.min(current.selectionStart.y, y),
          width: Math.abs(x - current.selectionStart.x),
          height: Math.abs(y - current.selectionStart.y),
        },
      };
    });
  }, []);

  const handleMouseUp = useCallback((
    viewport: Viewport | null,
    currentPage: number,
    onCreateAnnotation: (
      pageIndex: number,
      boundingBox: BoundingBox,
      annotationType: AnnotationType,
      quotedText?: string
    ) => void,
    textLayerRef?: React.RefObject<HTMLDivElement>
  ) => {
    const { isSelecting, selectionRect } = drawingState;

    if (!isSelecting || !selectionRect || !viewport) {
      setDrawingState(initialDrawingState);
      return;
    }

    // Only create annotation if selection is large enough
    if (selectionRect.width > 10 && selectionRect.height > 10) {
      // Normalize coordinates to 0-1 range relative to viewport
      const normalizedBox: BoundingBox = {
        x: selectionRect.x / viewport.width,
        y: selectionRect.y / viewport.height,
        width: selectionRect.width / viewport.width,
        height: selectionRect.height / viewport.height,
      };

      // Extract text from overlapping text layer spans
      let selectedText: string | undefined;
      if (textLayerRef?.current) {
        selectedText = extractTextFromSelection(
          textLayerRef.current,
          selectionRect,
          viewport
        );
      }
      // Fallback to browser selection if no text extracted
      if (!selectedText) {
        selectedText = window.getSelection()?.toString() || undefined;
      }

      onCreateAnnotation(
        currentPage - 1,
        normalizedBox,
        toolMode as AnnotationType,
        selectedText || undefined
      );
    }

    // Reset drawing state and return to select mode
    setDrawingState(initialDrawingState);
    setToolMode("select");
  }, [drawingState, toolMode]);

  const resetDrawing = useCallback(() => {
    setDrawingState(initialDrawingState);
  }, []);

  return {
    toolMode,
    drawingState,
    setToolMode,
    toggleToolMode,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetDrawing,
  };
}
