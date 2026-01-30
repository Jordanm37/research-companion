import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Initialize pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface Viewport {
  width: number;
  height: number;
}

export interface UsePdfRendererResult {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  totalPages: number;
  scale: number;
  viewport: Viewport | null;
  loading: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  textLayerRef: React.RefObject<HTMLDivElement>;
  setCurrentPage: (page: number) => void;
  setScale: (scale: number) => void;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface UsePdfRendererOptions {
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  scaleStep?: number;
}

export function usePdfRenderer(
  pdfUrl: string | null,
  options: UsePdfRendererOptions = {}
): UsePdfRendererResult {
  const {
    initialScale = 1.2,
    minScale = 0.5,
    maxScale = 3,
    scaleStep = 0.2,
  } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(initialScale);
  const [loading, setLoading] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!pdfUrl) {
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      setViewport(null);
      return;
    }

    setLoading(true);
    const loadingTask = pdfjsLib.getDocument(pdfUrl);

    loadingTask.promise
      .then((doc) => {
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading PDF:", err);
        setLoading(false);
      });

    return () => {
      loadingTask.destroy();
    };
  }, [pdfUrl]);

  // Render page function
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;

    const page = await pdfDoc.getPage(pageNum);
    const pageViewport = page.getViewport({ scale });
    setViewport({ width: pageViewport.width, height: pageViewport.height });

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.height = pageViewport.height;
    canvas.width = pageViewport.width;

    await page.render({
      canvasContext: context,
      viewport: pageViewport,
      canvas: canvas,
    } as any).promise;

    // Render text layer for selection
    const textLayer = textLayerRef.current;
    textLayer.innerHTML = "";
    textLayer.style.width = `${pageViewport.width}px`;
    textLayer.style.height = `${pageViewport.height}px`;

    const textContent = await page.getTextContent();
    const textItems = textContent.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;

    textItems.forEach((item) => {
      if (!item.str) return;

      const div = document.createElement("span");
      div.textContent = item.str;

      const tx = pdfjsLib.Util.transform(pageViewport.transform, item.transform);
      const fontHeight = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
      const angle = Math.atan2(tx[1], tx[0]);

      // tx[5] is baseline position from bottom; subtract fontHeight for top of text
      const topPos = pageViewport.height - tx[5] - fontHeight;

      div.style.left = `${tx[4]}px`;
      div.style.top = `${topPos}px`;
      div.style.fontSize = `${fontHeight}px`;
      div.style.fontFamily = "sans-serif";
      div.style.position = "absolute";
      div.style.whiteSpace = "pre";
      div.style.cursor = "text";
      div.style.color = "transparent";
      div.style.userSelect = "text";
      // Ensure line-height matches font for precise selection
      div.style.lineHeight = "1";

      if (angle !== 0) {
        div.style.transform = `rotate(${angle}rad)`;
        div.style.transformOrigin = "left top";
      }

      textLayer.appendChild(div);
    });
  }, [pdfDoc, scale]);

  // Render current page when document or page changes
  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  // Navigation handlers
  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(maxScale, prev + scaleStep));
  }, [maxScale, scaleStep]);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(minScale, prev - scaleStep));
  }, [minScale, scaleStep]);

  // Bounded setCurrentPage
  const setCurrentPageBounded = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  return {
    pdfDoc,
    currentPage,
    totalPages,
    scale,
    viewport,
    loading,
    canvasRef,
    textLayerRef,
    setCurrentPage: setCurrentPageBounded,
    setScale,
    goToPreviousPage,
    goToNextPage,
    zoomIn,
    zoomOut,
  };
}
