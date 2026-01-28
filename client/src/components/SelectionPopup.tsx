import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Compass, 
  MessageCircleQuestion, 
  Send,
  X
} from "lucide-react";
import { useState } from "react";
import type { ResearchActionType } from "@shared/schema";

interface SelectionPopupProps {
  selectedText: string;
  position: { x: number; y: number };
  onAction: (actionType: ResearchActionType, customQuery?: string) => void;
  onClose: () => void;
}

export function SelectionPopup({ 
  selectedText, 
  position, 
  onAction, 
  onClose 
}: SelectionPopupProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQuery, setCustomQuery] = useState("");

  const handleAction = (actionType: ResearchActionType) => {
    onAction(actionType);
    onClose();
  };

  const handleCustomSubmit = () => {
    if (customQuery.trim()) {
      onAction("custom_query", customQuery.trim());
      onClose();
    }
  };

  const truncatedText = selectedText.length > 80 
    ? selectedText.slice(0, 80) + "..." 
    : selectedText;

  return (
    <div
      className="fixed z-50 bg-card border shadow-lg rounded-md p-2 min-w-[280px] max-w-[360px]"
      style={{
        left: position.x,
        top: position.y,
        transform: "translateX(-50%)",
      }}
      data-testid="selection-popup"
    >
      <div className="flex items-center justify-between mb-2 pb-2 border-b">
        <span className="text-xs text-muted-foreground truncate pr-2 italic">
          "{truncatedText}"
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
          data-testid="button-close-popup"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {!showCustomInput ? (
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-8"
            onClick={() => handleAction("find_similar")}
            data-testid="button-find-similar"
          >
            <Search className="w-4 h-4" />
            <span>Find similar papers</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-8"
            onClick={() => handleAction("explore_topic")}
            data-testid="button-explore-topic"
          >
            <Compass className="w-4 h-4" />
            <span>Explore this topic</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-8"
            onClick={() => handleAction("ask_question")}
            data-testid="button-ask-question"
          >
            <MessageCircleQuestion className="w-4 h-4" />
            <span>Explain this</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-8"
            onClick={() => setShowCustomInput(true)}
            data-testid="button-custom-query"
          >
            <Send className="w-4 h-4" />
            <span>Ask a custom question...</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Type your question..."
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomSubmit();
              if (e.key === "Escape") setShowCustomInput(false);
            }}
            autoFocus
            data-testid="input-custom-query"
          />
          <div className="flex gap-1 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCustomInput(false)}
              data-testid="button-cancel-custom"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCustomSubmit}
              disabled={!customQuery.trim()}
              data-testid="button-submit-custom"
            >
              <Send className="w-3 h-3 mr-1" />
              Ask
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
