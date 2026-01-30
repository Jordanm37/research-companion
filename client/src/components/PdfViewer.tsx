import { useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { SelectionPopup } from "./SelectionPopup";
import {
  PdfCanvas,
  AnnotationLayer,
  DrawingLayer,
  PdfToolbar,
  PaperList,
} from "./pdf";
import type { PaperItem } from "./pdf";
import { usePdfRenderer } from "@/hooks/usePdfRenderer";
import { useDrawingTool } from "@/hooks/useDrawingTool";
import { useTextSelection } from "@/hooks/useTextSelection";
import type {
  Annotation,
  AnnotationType,
  BoundingBox,
  ResearchActionType,
} from "@shared/schema";

interface PdfViewerProps {
  pdfUrl: string | null;
  annotations: Annotation[];
  onCreateAnnotation: (
    pageIndex: number,
    boundingBox: BoundingBox,
    annotationType: AnnotationType,
    quotedText?: string
  ) => void;
  highlightAnnotationId: string | null;
  onAnnotationClick: (annotationId: string) => void;
  onResearchAction?: (
    selectedText: string,
    actionType: ResearchActionType,
    customQuery?: string
  ) => void;
  papers?: PaperItem[];
  onSelectPaper?: (paperId: string) => void;
}

export function PdfViewer({
  pdfUrl,
  annotations,
  onCreateAnnotation,
  highlightAnnotationId,
  onAnnotationClick,
  onResearchAction,
  papers = [],
  onSelectPaper,
}: PdfViewerProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // PDF rendering hook
  const {
    currentPage,
    totalPages,
    scale,
    viewport,
    loading,
    canvasRef,
    textLayerRef,
    setCurrentPage,
    goToPreviousPage,
    goToNextPage,
    zoomIn,
    zoomOut,
  } = usePdfRenderer(pdfUrl);

  // Drawing tool hook
  const {
    toolMode,
    drawingState,
    setToolMode,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useDrawingTool();

  // Text selection hook
  const { selectionPopup, handleTextSelection, handleResearchAction, closePopup } =
    useTextSelection();

  // Navigate to highlighted annotation's page
  useEffect(() => {
    if (highlightAnnotationId && annotations.length > 0) {
      const annotation = annotations.find((a) => a.id === highlightAnnotationId);
      if (annotation && annotation.pageIndex + 1 !== currentPage) {
        setCurrentPage(annotation.pageIndex + 1);
      }
    }
  }, [highlightAnnotationId, annotations, currentPage, setCurrentPage]);

  // Filter annotations for current page
  const pageAnnotations = annotations.filter((a) => a.pageIndex === currentPage - 1);

  // Get canvas bounding rect for drawing calculations
  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect() || null;
  }, [canvasRef]);

  // Drawing event handlers
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => handleMouseDown(e, getCanvasRect()),
    [handleMouseDown, getCanvasRect]
  );

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => handleMouseMove(e, getCanvasRect()),
    [handleMouseMove, getCanvasRect]
  );

  const onCanvasMouseUp = useCallback(() => {
    handleMouseUp(viewport, currentPage, onCreateAnnotation, textLayerRef);
  }, [handleMouseUp, viewport, currentPage, onCreateAnnotation, textLayerRef]);

  // Text selection handler
  const onContainerMouseUp = useCallback(() => {
    handleTextSelection(toolMode, textLayerRef, viewport);
  }, [handleTextSelection, toolMode, textLayerRef, viewport]);

  // Research action handler
  const onResearchActionClick = useCallback(
    (actionType: ResearchActionType, customQuery?: string) => {
      handleResearchAction(actionType, onResearchAction, customQuery);
    },
    [handleResearchAction, onResearchAction]
  );

  // Empty state - no PDF loaded
  if (!pdfUrl) {
    return <PaperList papers={papers} onSelectPaper={onSelectPaper} />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading PDF...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PdfToolbar
        currentPage={currentPage}
        totalPages={totalPages}
        onPreviousPage={goToPreviousPage}
        onNextPage={goToNextPage}
        scale={scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        toolMode={toolMode}
        onToolModeChange={setToolMode}
      />

      <div
        className="flex-1 overflow-auto bg-muted/20 p-4"
        onMouseUp={onContainerMouseUp}
      >
        <div className="flex justify-center">
          <PdfCanvas
            ref={canvasContainerRef}
            canvasRef={canvasRef}
            textLayerRef={textLayerRef}
            viewport={viewport}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
          >
            <AnnotationLayer
              annotations={pageAnnotations}
              viewport={viewport}
              highlightAnnotationId={highlightAnnotationId}
              onAnnotationClick={onAnnotationClick}
            />
            <DrawingLayer drawingState={drawingState} viewport={viewport} />
          </PdfCanvas>
        </div>
      </div>

      {selectionPopup && onResearchAction && (
        <SelectionPopup
          selectedText={selectionPopup.text}
          position={selectionPopup.position}
          onAction={onResearchActionClick}
          onClose={closePopup}
          onCreateAnnotation={onCreateAnnotation}
          currentPage={currentPage - 1}
          selectionBounds={selectionPopup.bounds}
        />
      )}
    </div>
  );
}
