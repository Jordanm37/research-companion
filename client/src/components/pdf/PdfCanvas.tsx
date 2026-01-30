import { forwardRef } from "react";
import type { Viewport } from "@/hooks/usePdfRenderer";

interface PdfCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  textLayerRef: React.RefObject<HTMLDivElement>;
  viewport: Viewport | null;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}

/**
 * Pure pdf.js canvas rendering component.
 * Renders the PDF page canvas and text layer for selection.
 * Uses refs passed from the parent hook for actual rendering.
 */
export const PdfCanvas = forwardRef<HTMLDivElement, PdfCanvasProps>(
  function PdfCanvas(
    {
      canvasRef,
      textLayerRef,
      viewport,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      children,
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className="relative shadow-lg bg-white"
        style={{
          width: viewport?.width || "100%",
          height: viewport?.height || "auto",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {/* PDF canvas layer */}
        <canvas ref={canvasRef} className="block" />

        {/* Text layer for selection */}
        <div
          ref={textLayerRef}
          className="pdf-text-layer absolute top-0 left-0 overflow-hidden"
          style={{ mixBlendMode: "multiply" }}
        />

        {/* Overlay layers (annotations, drawing) */}
        {children}
      </div>
    );
  }
);

export default PdfCanvas;
