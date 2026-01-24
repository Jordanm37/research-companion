import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Highlighter, 
  Square, 
  StickyNote, 
  MessageSquare,
  Check,
  X
} from "lucide-react";
import type { Annotation } from "@shared/schema";

interface AnnotationsListProps {
  annotations: Annotation[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onAnnotationClick: (id: string) => void;
  onUpdateComment: (id: string, comment: string) => void;
  highlightedId: string | null;
}

const annotationTypeConfig = {
  highlight: { icon: Highlighter, label: "Highlight", color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  rectangle: { icon: Square, label: "Figure", color: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  margin_note: { icon: StickyNote, label: "Note", color: "bg-pink-500/20 text-pink-700 dark:text-pink-400" },
};

export function AnnotationsList({
  annotations,
  selectedIds,
  onToggleSelect,
  onAnnotationClick,
  onUpdateComment,
  highlightedId,
}: AnnotationsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");

  const handleStartEdit = (annotation: Annotation) => {
    setEditingId(annotation.id);
    setEditComment(annotation.comment || "");
  };

  const handleSaveComment = (id: string) => {
    onUpdateComment(id, editComment);
    setEditingId(null);
    setEditComment("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditComment("");
  };

  const sortedAnnotations = [...annotations].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    return a.boundingBox.y - b.boundingBox.y;
  });

  if (annotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Highlighter className="w-6 h-6 text-muted-foreground" />
        </div>
        <h4 className="text-sm font-medium mb-1" data-testid="text-no-annotations-title">No Annotations Yet</h4>
        <p className="text-xs text-muted-foreground" data-testid="text-no-annotations-description">
          Select text or use the tools to create annotations
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-2">
        {sortedAnnotations.map((annotation) => {
          const config = annotationTypeConfig[annotation.annotationType];
          const Icon = config.icon;
          const isSelected = selectedIds.includes(annotation.id);
          const isHighlighted = highlightedId === annotation.id;
          const isEditing = editingId === annotation.id;

          return (
            <div
              key={annotation.id}
              className={`p-3 rounded-md border transition-all cursor-pointer hover-elevate ${
                isHighlighted
                  ? "ring-2 ring-primary border-primary"
                  : isSelected
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card"
              }`}
              onClick={() => onAnnotationClick(annotation.id)}
              data-testid={`annotation-item-${annotation.id}`}
            >
              <div className="flex items-start gap-2">
                <button
                  className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input bg-background"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(annotation.id);
                  }}
                  data-testid={`checkbox-annotation-${annotation.id}`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="secondary" className={`text-xs ${config.color}`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Page {annotation.pageIndex + 1}
                    </span>
                  </div>

                  {annotation.quotedText && (
                    <p className="text-sm font-serif italic text-foreground/80 line-clamp-3 mb-2" data-testid={`text-quote-${annotation.id}`}>
                      "{annotation.quotedText}"
                    </p>
                  )}

                  {!annotation.quotedText && annotation.annotationType === "rectangle" && (
                    <p className="text-sm text-muted-foreground mb-2" data-testid={`text-area-${annotation.id}`}>
                      Selected area
                    </p>
                  )}

                  {isEditing ? (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="text-sm min-h-[60px]"
                        autoFocus
                        data-testid={`input-comment-${annotation.id}`}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => handleSaveComment(annotation.id)}
                          data-testid={`button-save-comment-${annotation.id}`}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          data-testid={`button-cancel-comment-${annotation.id}`}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {annotation.comment && (
                        <p className="text-sm text-foreground/70 mt-1" data-testid={`text-comment-${annotation.id}`}>
                          {annotation.comment}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(annotation);
                        }}
                        data-testid={`button-edit-comment-${annotation.id}`}
                      >
                        <MessageSquare className="w-3 h-3 mr-1" />
                        {annotation.comment ? "Edit comment" : "Add comment"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
