import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Compass,
  MessageCircleQuestion,
  Send,
  X,
  BookOpen,
  Highlighter,
  FileText,
  Sparkles,
  Loader2
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { ResearchActionType, NoteType, AnnotationType, BoundingBox } from "@shared/schema";

interface SelectionPopupProps {
  selectedText: string;
  position: { x: number; y: number };
  onAction: (actionType: ResearchActionType, customQuery?: string) => void;
  onClose: () => void;
  // New props for unified functionality
  onCreateAnnotation?: (
    pageIndex: number,
    boundingBox: BoundingBox,
    annotationType: AnnotationType,
    quotedText?: string
  ) => void;
  onCreateAnnotationWithNote?: (
    annotationType: AnnotationType,
    quotedText: string,
    noteType: NoteType,
    noteContent: string
  ) => void;
  currentPage?: number;
  selectionBounds?: BoundingBox;
}

const noteTypeOptions: { value: NoteType; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "insight", label: "Insight" },
  { value: "question", label: "Question" },
  { value: "critique", label: "Critique" },
  { value: "custom", label: "Custom" },
];

export function SelectionPopup({
  selectedText,
  position,
  onAction,
  onClose,
  onCreateAnnotation,
  onCreateAnnotationWithNote,
  currentPage = 0,
  selectionBounds,
}: SelectionPopupProps) {
  const [activeTab, setActiveTab] = useState("quick");
  const [customQuery, setCustomQuery] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("insight");
  const popupRef = useRef<HTMLDivElement>(null);

  // Clamp position to viewport
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      const padding = 10;
      let newX = position.x;
      let newY = position.y;

      // Clamp horizontal
      if (rect.left < padding) {
        newX = rect.width / 2 + padding;
      } else if (rect.right > window.innerWidth - padding) {
        newX = window.innerWidth - rect.width / 2 - padding;
      }

      // Clamp vertical - flip above if near bottom
      if (rect.bottom > window.innerHeight - padding) {
        newY = position.y - rect.height - 20;
      }

      if (newX !== position.x || newY !== position.y) {
        setAdjustedPosition({ x: newX, y: newY });
      }
    }
  }, [position]);

  const handleResearchAction = (actionType: ResearchActionType) => {
    onAction(actionType);
    onClose();
  };

  const handleCustomSubmit = () => {
    if (customQuery.trim()) {
      onAction("custom_query", customQuery.trim());
      onClose();
    }
  };

  const handleSaveHighlight = () => {
    if (onCreateAnnotation && selectionBounds) {
      onCreateAnnotation(currentPage, selectionBounds, "highlight", selectedText);
      onClose();
    }
  };

  const handleSaveWithNote = () => {
    if (onCreateAnnotationWithNote && noteContent.trim()) {
      onCreateAnnotationWithNote("highlight", selectedText, noteType, noteContent.trim());
      onClose();
    }
  };

  const truncatedText =
    selectedText.length > 60 ? selectedText.slice(0, 60) + "..." : selectedText;

  const canSaveAnnotation = onCreateAnnotation && selectionBounds;

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-card border shadow-lg rounded-md p-3 min-w-[320px] max-w-[400px]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        transform: "translateX(-50%)",
      }}
      data-testid="selection-popup"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b">
        <span className="text-xs text-muted-foreground truncate pr-2 italic flex-1">
          "{truncatedText}"
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 h-6 w-6"
          onClick={onClose}
          data-testid="button-close-popup"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="quick" className="text-xs">Quick</TabsTrigger>
          <TabsTrigger value="note" className="text-xs">Note</TabsTrigger>
          <TabsTrigger value="research" className="text-xs">Research</TabsTrigger>
        </TabsList>

        {/* Quick Actions Tab */}
        <TabsContent value="quick" className="mt-2 space-y-1">
          {canSaveAnnotation && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleSaveHighlight}
              data-testid="button-save-highlight"
            >
              <Highlighter className="w-4 h-4 text-yellow-600" />
              <span>Save as Highlight</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleResearchAction("ask_question")}
            data-testid="button-explain"
          >
            <MessageCircleQuestion className="w-4 h-4" />
            <span>Explain this</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleResearchAction("find_similar")}
            data-testid="button-find-similar"
          >
            <Search className="w-4 h-4" />
            <span>Find similar papers</span>
          </Button>
        </TabsContent>

        {/* Note Creation Tab */}
        <TabsContent value="note" className="mt-2 space-y-2">
          {canSaveAnnotation ? (
            <>
              <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Note type" />
                </SelectTrigger>
                <SelectContent>
                  {noteTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add your thoughts..."
                className="text-sm min-h-[60px]"
                data-testid="input-note-content"
              />
              <Button
                size="sm"
                className="w-full"
                onClick={handleSaveWithNote}
                disabled={!noteContent.trim()}
                data-testid="button-save-with-note"
              >
                <FileText className="w-3 h-3 mr-1" />
                Save Highlight + Note
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Note creation requires annotation support
            </p>
          )}
        </TabsContent>

        {/* Research Tab */}
        <TabsContent value="research" className="mt-2 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleResearchAction("explore_topic")}
            data-testid="button-explore-topic"
          >
            <Compass className="w-4 h-4" />
            <span>Explore this topic</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleResearchAction("paper_summary")}
            data-testid="button-paper-summary"
          >
            <BookOpen className="w-4 h-4" />
            <span>Summarize cited paper</span>
          </Button>
          <div className="pt-2 border-t mt-2">
            <div className="flex gap-1">
              <Input
                placeholder="Ask a question..."
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customQuery.trim()) handleCustomSubmit();
                }}
                className="text-sm h-8"
                data-testid="input-custom-query"
              />
              <Button
                size="sm"
                className="h-8 px-2"
                onClick={handleCustomSubmit}
                disabled={!customQuery.trim()}
                data-testid="button-submit-custom"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
