import { useState, useCallback } from "react";
import type { ResearchActionType, BoundingBox } from "@shared/schema";
import type { Viewport } from "./usePdfRenderer";

export interface SelectionPopupState {
  text: string;
  position: { x: number; y: number };
  bounds?: BoundingBox; // Normalized bounds relative to viewport
}

export interface UseTextSelectionResult {
  selectionPopup: SelectionPopupState | null;
  handleTextSelection: (
    toolMode: string,
    textLayerRef?: React.RefObject<HTMLDivElement>,
    viewport?: Viewport | null
  ) => void;
  handleResearchAction: (
    actionType: ResearchActionType,
    onResearchAction?: (selectedText: string, actionType: ResearchActionType, customQuery?: string) => void,
    customQuery?: string
  ) => void;
  closePopup: () => void;
  clearSelection: () => void;
}

export function useTextSelection(): UseTextSelectionResult {
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopupState | null>(null);

  const handleTextSelection = useCallback((
    toolMode: string,
    textLayerRef?: React.RefObject<HTMLDivElement>,
    viewport?: Viewport | null
  ) => {
    // Only handle text selection in select mode
    if (toolMode !== "select") return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const text = selection.toString().trim();
    // Require minimum text length
    if (!text || text.length < 3) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate normalized bounds if we have the text layer reference
    let bounds: BoundingBox | undefined;
    if (textLayerRef?.current && viewport) {
      const layerRect = textLayerRef.current.getBoundingClientRect();
      bounds = {
        x: (rect.left - layerRect.left) / viewport.width,
        y: (rect.top - layerRect.top) / viewport.height,
        width: rect.width / viewport.width,
        height: rect.height / viewport.height,
      };
    }

    setSelectionPopup({
      text,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10,
      },
      bounds,
    });
  }, []);

  const handleResearchAction = useCallback((
    actionType: ResearchActionType,
    onResearchAction?: (selectedText: string, actionType: ResearchActionType, customQuery?: string) => void,
    customQuery?: string
  ) => {
    if (selectionPopup && onResearchAction) {
      onResearchAction(selectionPopup.text, actionType, customQuery);
      window.getSelection()?.removeAllRanges();
    }
  }, [selectionPopup]);

  const closePopup = useCallback(() => {
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionPopup(null);
  }, []);

  return {
    selectionPopup,
    handleTextSelection,
    handleResearchAction,
    closePopup,
    clearSelection,
  };
}
