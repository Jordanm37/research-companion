import type { DrawingState } from "@/hooks/useDrawingTool";
import type { Viewport } from "@/hooks/usePdfRenderer";

interface DrawingLayerProps {
  drawingState: DrawingState;
  viewport: Viewport | null;
}

/**
 * Drawing overlay component for creating annotations.
 * Renders selection rectangle during drawing operations.
 */
export function DrawingLayer({ drawingState, viewport }: DrawingLayerProps) {
  const { isSelecting, selectionRect } = drawingState;

  if (!viewport || !selectionRect || !isSelecting) {
    return null;
  }

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: viewport.width,
        height: viewport.height,
      }}
    >
      <div
        className="absolute border-2 border-dashed border-primary bg-primary/10"
        style={{
          left: selectionRect.x,
          top: selectionRect.y,
          width: selectionRect.width,
          height: selectionRect.height,
        }}
      />
    </div>
  );
}

export default DrawingLayer;
