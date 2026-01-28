import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { SelectionPopup } from "./SelectionPopup";
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Highlighter, 
  Square, 
  StickyNote,
  Loader2
} from "lucide-react";
import type { Annotation, AnnotationType, BoundingBox, ResearchActionType } from "@shared/schema";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PaperItem {
  id: string;
  title?: string;
  filename: string;
}

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
  onResearchAction?: (selectedText: string, actionType: ResearchActionType, customQuery?: string) => void;
  papers?: PaperItem[];
  onSelectPaper?: (paperId: string) => void;
}

type ToolMode = "select" | "highlight" | "rectangle" | "margin_note";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const annotationLayerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<BoundingBox | null>(null);
  const [pageViewport, setPageViewport] = useState<{ width: number; height: number } | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{
    text: string;
    position: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (!pdfUrl) return;

    setLoading(true);
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise.then((doc) => {
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setLoading(false);
    }).catch((err) => {
      console.error("Error loading PDF:", err);
      setLoading(false);
    });

    return () => {
      loadingTask.destroy();
    };
  }, [pdfUrl]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    setPageViewport({ width: viewport.width, height: viewport.height });

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    } as any).promise;

    const textLayer = textLayerRef.current;
    textLayer.innerHTML = "";
    textLayer.style.width = `${viewport.width}px`;
    textLayer.style.height = `${viewport.height}px`;

    const textContent = await page.getTextContent();
    const textItems = textContent.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;

    textItems.forEach((item) => {
      const div = document.createElement("span");
      div.textContent = item.str;
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      div.style.left = `${tx[4]}px`;
      div.style.top = `${viewport.height - tx[5]}px`;
      div.style.fontSize = `${Math.abs(tx[0])}px`;
      div.style.position = "absolute";
      div.style.whiteSpace = "pre";
      div.style.cursor = "text";
      div.style.color = "transparent";
      div.style.userSelect = "text";
      textLayer.appendChild(div);
    });
  }, [pdfDoc, scale]);

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  useEffect(() => {
    if (highlightAnnotationId && annotations.length > 0) {
      const annotation = annotations.find((a) => a.id === highlightAnnotationId);
      if (annotation && annotation.pageIndex + 1 !== currentPage) {
        setCurrentPage(annotation.pageIndex + 1);
      }
    }
  }, [highlightAnnotationId, annotations, currentPage]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (toolMode === "select") return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectionStart) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionRect({
      x: Math.min(selectionStart.x, x),
      y: Math.min(selectionStart.y, y),
      width: Math.abs(x - selectionStart.x),
      height: Math.abs(y - selectionStart.y),
    });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selectionRect || !pageViewport) return;

    if (selectionRect.width > 10 && selectionRect.height > 10) {
      const normalizedBox: BoundingBox = {
        x: selectionRect.x / pageViewport.width,
        y: selectionRect.y / pageViewport.height,
        width: selectionRect.width / pageViewport.width,
        height: selectionRect.height / pageViewport.height,
      };

      const selectedText = window.getSelection()?.toString() || undefined;
      onCreateAnnotation(currentPage - 1, normalizedBox, toolMode as AnnotationType, selectedText);
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionRect(null);
    setToolMode("select");
  };

  const handleTextSelection = () => {
    if (toolMode !== "select") return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 3) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectionPopup({
      text,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10,
      },
    });
  };

  const handleResearchAction = (actionType: ResearchActionType, customQuery?: string) => {
    if (selectionPopup && onResearchAction) {
      onResearchAction(selectionPopup.text, actionType, customQuery);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleClosePopup = () => {
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  const pageAnnotations = annotations.filter((a) => a.pageIndex === currentPage - 1);

  if (!pdfUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/30">
        <div className="text-center p-8 max-w-md w-full">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <StickyNote className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2" data-testid="text-no-pdf-title">No PDF Loaded</h3>
          <p className="text-sm text-muted-foreground mb-6" data-testid="text-no-pdf-description">
            Upload a PDF to start reading and annotating
          </p>
          
          {papers.length > 0 && (
            <div className="mt-4 text-left">
              <h4 className="text-sm font-medium mb-3 text-center">Your Papers</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {papers.map((paper) => (
                  <button
                    key={paper.id}
                    onClick={() => onSelectPaper?.(paper.id)}
                    className="w-full p-3 text-left rounded-md border bg-card hover-elevate transition-colors"
                    data-testid={`button-paper-${paper.id}`}
                  >
                    <div className="font-medium text-sm truncate">
                      {paper.title || paper.filename}
                    </div>
                    {paper.title && paper.title !== paper.filename && (
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {paper.filename}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

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
      <div className="flex items-center justify-between p-2 border-b bg-card gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm px-2 min-w-[80px] text-center" data-testid="text-page-number">
            {currentPage} / {totalPages}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            data-testid="button-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setScale(Math.max(0.5, scale - 0.2))}
            disabled={scale <= 0.5}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm px-2 min-w-[50px] text-center" data-testid="text-zoom-level">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setScale(Math.min(3, scale + 0.2))}
            disabled={scale >= 3}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant={toolMode === "highlight" ? "default" : "ghost"}
            onClick={() => setToolMode(toolMode === "highlight" ? "select" : "highlight")}
            data-testid="button-tool-highlight"
          >
            <Highlighter className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={toolMode === "rectangle" ? "default" : "ghost"}
            onClick={() => setToolMode(toolMode === "rectangle" ? "select" : "rectangle")}
            data-testid="button-tool-rectangle"
          >
            <Square className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={toolMode === "margin_note" ? "default" : "ghost"}
            onClick={() => setToolMode(toolMode === "margin_note" ? "select" : "margin_note")}
            data-testid="button-tool-margin-note"
          >
            <StickyNote className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/20 p-4"
        onMouseUp={handleTextSelection}
      >
        <div className="flex justify-center">
          <div
            className="relative shadow-lg bg-white"
            style={{
              width: pageViewport?.width || "100%",
              height: pageViewport?.height || "auto",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <canvas ref={canvasRef} className="block" />
            <div
              ref={textLayerRef}
              className="absolute top-0 left-0 overflow-hidden"
              style={{ mixBlendMode: "multiply" }}
            />
            <div
              ref={annotationLayerRef}
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: pageViewport?.width || 0,
                height: pageViewport?.height || 0,
              }}
            >
              {pageAnnotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className={`absolute pointer-events-auto cursor-pointer transition-all ${
                    highlightAnnotationId === annotation.id
                      ? "ring-2 ring-primary ring-offset-1"
                      : ""
                  }`}
                  style={{
                    left: `${annotation.boundingBox.x * (pageViewport?.width || 0)}px`,
                    top: `${annotation.boundingBox.y * (pageViewport?.height || 0)}px`,
                    width: `${annotation.boundingBox.width * (pageViewport?.width || 0)}px`,
                    height: `${annotation.boundingBox.height * (pageViewport?.height || 0)}px`,
                    backgroundColor:
                      annotation.annotationType === "highlight"
                        ? "hsl(var(--highlight-yellow) / 0.4)"
                        : annotation.annotationType === "rectangle"
                        ? "hsl(var(--highlight-blue) / 0.25)"
                        : "hsl(var(--highlight-pink) / 0.35)",
                    border:
                      annotation.annotationType === "rectangle"
                        ? "2px solid hsl(var(--highlight-blue))"
                        : "none",
                  }}
                  onClick={() => onAnnotationClick(annotation.id)}
                  data-testid={`annotation-overlay-${annotation.id}`}
                />
              ))}

              {selectionRect && isSelecting && (
                <div
                  className="absolute border-2 border-dashed border-primary bg-primary/10"
                  style={{
                    left: selectionRect.x,
                    top: selectionRect.y,
                    width: selectionRect.width,
                    height: selectionRect.height,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {selectionPopup && onResearchAction && (
        <SelectionPopup
          selectedText={selectionPopup.text}
          position={selectionPopup.position}
          onAction={handleResearchAction}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}
