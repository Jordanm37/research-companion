import type { Annotation } from "@shared/schema";
import type { Viewport } from "@/hooks/usePdfRenderer";

interface AnnotationLayerProps {
  annotations: Annotation[];
  viewport: Viewport | null;
  highlightAnnotationId: string | null;
  onAnnotationClick: (annotationId: string) => void;
}

/**
 * Get background color for annotation based on type.
 */
function getAnnotationBackgroundColor(annotationType: string): string {
  switch (annotationType) {
    case "highlight":
      return "hsl(var(--highlight-yellow) / 0.4)";
    case "rectangle":
      return "hsl(var(--highlight-blue) / 0.25)";
    case "margin_note":
    default:
      return "hsl(var(--highlight-pink) / 0.35)";
  }
}

/**
 * Get border style for annotation based on type.
 */
function getAnnotationBorder(annotationType: string): string {
  if (annotationType === "rectangle") {
    return "2px solid hsl(var(--highlight-blue))";
  }
  return "none";
}

/**
 * Annotation overlay rendering component.
 * Renders annotation overlays with proper positioning based on normalized coordinates.
 */
export function AnnotationLayer({
  annotations,
  viewport,
  highlightAnnotationId,
  onAnnotationClick,
}: AnnotationLayerProps) {
  if (!viewport) return null;

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: viewport.width,
        height: viewport.height,
      }}
    >
      {annotations.map((annotation) => {
        const isHighlighted = highlightAnnotationId === annotation.id;
        const { boundingBox, annotationType, id } = annotation;

        return (
          <div
            key={id}
            className={`absolute pointer-events-auto cursor-pointer transition-all ${
              isHighlighted ? "ring-2 ring-primary ring-offset-1" : ""
            }`}
            style={{
              left: `${boundingBox.x * viewport.width}px`,
              top: `${boundingBox.y * viewport.height}px`,
              width: `${boundingBox.width * viewport.width}px`,
              height: `${boundingBox.height * viewport.height}px`,
              backgroundColor: getAnnotationBackgroundColor(annotationType),
              border: getAnnotationBorder(annotationType),
            }}
            onClick={() => onAnnotationClick(id)}
            data-testid={`annotation-overlay-${id}`}
          />
        );
      })}
    </div>
  );
}

export default AnnotationLayer;
