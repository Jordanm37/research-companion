import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnotationsList } from "./AnnotationsList";
import { NotesList } from "./NotesList";
import { ResearchChat } from "./ResearchChat";
import { MessageSquareText, FileText, Bot } from "lucide-react";
import type { Annotation, NoteAtom, NoteType, AIActionType, ResearchChatMessage } from "@shared/schema";

interface SidePanelProps {
  annotations: Annotation[];
  notes: NoteAtom[];
  selectedAnnotationIds: string[];
  onToggleAnnotationSelect: (id: string) => void;
  onAnnotationClick: (id: string) => void;
  onUpdateAnnotationComment: (id: string, comment: string) => void;
  highlightedAnnotationId: string | null;
  onCreateNote: (type: NoteType, content: string, annotationIds: string[]) => void;
  onUpdateNote: (id: string, updates: { content?: string; noteType?: NoteType }) => void;
  onDeleteNote: (id: string) => void;
  onAIAction: (actionType: AIActionType, annotationIds: string[], noteIds: string[]) => Promise<string>;
  isAILoading: boolean;
  paperId: string | null;
  researchChatMessages: ResearchChatMessage[];
  isResearchChatLoading: boolean;
  researchChatStreamingContent: string;
  onClearResearchChat: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function SidePanel({
  annotations,
  notes,
  selectedAnnotationIds,
  onToggleAnnotationSelect,
  onAnnotationClick,
  onUpdateAnnotationComment,
  highlightedAnnotationId,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onAIAction,
  isAILoading,
  paperId,
  researchChatMessages,
  isResearchChatLoading,
  researchChatStreamingContent,
  onClearResearchChat,
  activeTab = "annotations",
  onTabChange,
}: SidePanelProps) {
  return (
    <div className="h-full flex flex-col bg-card border-l">
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full">
        <TabsList className="grid w-full grid-cols-3 rounded-none border-b h-auto p-0">
          <TabsTrigger 
            value="annotations" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3"
            data-testid="tab-annotations"
          >
            <MessageSquareText className="w-4 h-4 mr-2" />
            Annotations
          </TabsTrigger>
          <TabsTrigger 
            value="notes" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3"
            data-testid="tab-notes"
          >
            <FileText className="w-4 h-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger 
            value="research" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3"
            data-testid="tab-research"
          >
            <Bot className="w-4 h-4 mr-2" />
            Research
          </TabsTrigger>
        </TabsList>

        <TabsContent value="annotations" className="flex-1 m-0 overflow-hidden">
          <AnnotationsList
            annotations={annotations}
            selectedIds={selectedAnnotationIds}
            onToggleSelect={onToggleAnnotationSelect}
            onAnnotationClick={onAnnotationClick}
            onUpdateComment={onUpdateAnnotationComment}
            highlightedId={highlightedAnnotationId}
          />
        </TabsContent>

        <TabsContent value="notes" className="flex-1 m-0 overflow-hidden">
          <NotesList
            notes={notes}
            selectedAnnotationIds={selectedAnnotationIds}
            onCreateNote={onCreateNote}
            onUpdateNote={onUpdateNote}
            onDeleteNote={onDeleteNote}
            onAIAction={onAIAction}
            isAILoading={isAILoading}
          />
        </TabsContent>

        <TabsContent value="research" className="flex-1 m-0 overflow-hidden">
          <ResearchChat
            paperId={paperId}
            messages={researchChatMessages}
            isLoading={isResearchChatLoading}
            streamingContent={researchChatStreamingContent}
            onClearChat={onClearResearchChat}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
