import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  AlertCircle, 
  HelpCircle, 
  Lightbulb, 
  Link2, 
  FlaskConical,
  Target,
  Pencil,
  Check,
  X,
  Trash2,
  Sparkles,
  Loader2,
  BookOpen
} from "lucide-react";
import type { NoteAtom, NoteType, AIActionType } from "@shared/schema";

interface NotesListProps {
  notes: NoteAtom[];
  selectedAnnotationIds: string[];
  onCreateNote: (type: NoteType, content: string, annotationIds: string[]) => void;
  onUpdateNote: (id: string, updates: { content?: string; noteType?: NoteType }) => void;
  onDeleteNote: (id: string) => void;
  onAIAction: (actionType: AIActionType, annotationIds: string[], noteIds: string[]) => Promise<string>;
  isAILoading: boolean;
}

const noteTypeConfig: Record<NoteType, { icon: typeof FileText; label: string; color: string }> = {
  summary: { icon: FileText, label: "Summary", color: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  critique: { icon: AlertCircle, label: "Critique", color: "bg-orange-500/20 text-orange-700 dark:text-orange-400" },
  question: { icon: HelpCircle, label: "Question", color: "bg-purple-500/20 text-purple-700 dark:text-purple-400" },
  insight: { icon: Lightbulb, label: "Insight", color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  connection: { icon: Link2, label: "Connection", color: "bg-green-500/20 text-green-700 dark:text-green-400" },
  methodology: { icon: FlaskConical, label: "Methodology", color: "bg-teal-500/20 text-teal-700 dark:text-teal-400" },
  finding: { icon: Target, label: "Finding", color: "bg-red-500/20 text-red-700 dark:text-red-400" },
  custom: { icon: Pencil, label: "Custom", color: "bg-gray-500/20 text-gray-700 dark:text-gray-400" },
};

const aiActions: { type: AIActionType; label: string; description: string }[] = [
  { type: "summarize", label: "Summarize", description: "Create a concise summary" },
  { type: "critique", label: "Critique", description: "Analyze strengths and weaknesses" },
  { type: "question", label: "Question", description: "Generate research questions" },
  { type: "connect", label: "Connect", description: "Find connections to other concepts" },
  { type: "expand", label: "Expand", description: "Elaborate on key points" },
];

export function NotesList({
  notes,
  selectedAnnotationIds,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onAIAction,
  isAILoading,
}: NotesListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteType, setNewNoteType] = useState<NoteType>("insight");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editType, setEditType] = useState<NoteType>("insight");
  const [aiPreviewContent, setAiPreviewContent] = useState<string | null>(null);
  const [pendingAiType, setPendingAiType] = useState<NoteType | null>(null);

  const handleCreateNote = () => {
    if (!newNoteContent.trim() || selectedAnnotationIds.length === 0) return;
    onCreateNote(newNoteType, newNoteContent.trim(), selectedAnnotationIds);
    setNewNoteContent("");
    setIsCreating(false);
  };

  const handleStartEdit = (note: NoteAtom) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditType(note.noteType);
  };

  const handleSaveEdit = (id: string) => {
    onUpdateNote(id, { content: editContent, noteType: editType });
    setEditingId(null);
  };

  const handleAIAction = async (actionType: AIActionType) => {
    const result = await onAIAction(actionType, selectedAnnotationIds, []);
    setAiPreviewContent(result);
    setPendingAiType(
      actionType === "summarize" ? "summary" :
      actionType === "critique" ? "critique" :
      actionType === "question" ? "question" :
      actionType === "connect" ? "connection" :
      "insight"
    );
  };

  const handleConfirmAiNote = () => {
    if (!aiPreviewContent || !pendingAiType || selectedAnnotationIds.length === 0) return;
    onCreateNote(pendingAiType, aiPreviewContent, selectedAnnotationIds);
    setAiPreviewContent(null);
    setPendingAiType(null);
  };

  const handleCancelAiNote = () => {
    setAiPreviewContent(null);
    setPendingAiType(null);
  };

  const canCreateNote = selectedAnnotationIds.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-3">
        {canCreateNote && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {selectedAnnotationIds.length} annotation{selectedAnnotationIds.length !== 1 ? "s" : ""} selected
            </p>

            <div className="flex flex-wrap gap-1">
              {aiActions.map((action) => (
                <Button
                  key={action.type}
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => handleAIAction(action.type)}
                  disabled={isAILoading}
                  data-testid={`button-ai-${action.type}`}
                >
                  {isAILoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1" />
                  )}
                  {action.label}
                </Button>
              ))}
            </div>

            {!isCreating && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsCreating(true)}
                data-testid="button-create-note"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Create Note Manually
              </Button>
            )}
          </div>
        )}

        {!canCreateNote && !isCreating && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Select annotations to create notes or use AI actions
          </p>
        )}

        {aiPreviewContent && (
          <div className="p-3 rounded-md border border-primary/30 bg-primary/5 space-y-2">
            <div className="flex items-center gap-2 text-xs text-primary">
              <Sparkles className="w-3 h-3" />
              AI Generated Preview
            </div>
            <p className="text-sm whitespace-pre-wrap">{aiPreviewContent}</p>
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={handleConfirmAiNote}
                data-testid="button-confirm-ai-note"
              >
                <Check className="w-3 h-3 mr-1" />
                Create Note
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelAiNote}
                data-testid="button-cancel-ai-note"
              >
                <X className="w-3 h-3 mr-1" />
                Discard
              </Button>
            </div>
          </div>
        )}

        {isCreating && (
          <div className="space-y-2 p-3 rounded-md border bg-card">
            <Select value={newNoteType} onValueChange={(v) => setNewNoteType(v as NoteType)}>
              <SelectTrigger className="h-8" data-testid="select-note-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(noteTypeConfig).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <config.icon className="w-3 h-3" />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write your note..."
              className="min-h-[80px] text-sm"
              autoFocus
              data-testid="input-new-note-content"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={handleCreateNote}
                disabled={!newNoteContent.trim()}
                data-testid="button-save-new-note"
              >
                <Check className="w-3 h-3 mr-1" />
                Save Note
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setNewNoteContent("");
                }}
                data-testid="button-cancel-new-note"
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6 text-muted-foreground" />
              </div>
              <h4 className="text-sm font-medium mb-1" data-testid="text-no-notes-title">No Notes Yet</h4>
              <p className="text-xs text-muted-foreground" data-testid="text-no-notes-description">
                Select annotations and create notes from them
              </p>
            </div>
          ) : (
            notes.map((note) => {
              const config = noteTypeConfig[note.noteType];
              const Icon = config.icon;
              const isEditing = editingId === note.id;

              return (
                <div
                  key={note.id}
                  className="p-3 rounded-md border border-border bg-card"
                  data-testid={`note-item-${note.id}`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <Select value={editType} onValueChange={(v) => setEditType(v as NoteType)}>
                        <SelectTrigger className="h-8" data-testid={`select-edit-type-${note.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(noteTypeConfig).map(([type, cfg]) => (
                            <SelectItem key={type} value={type}>
                              <div className="flex items-center gap-2">
                                <cfg.icon className="w-3 h-3" />
                                {cfg.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px] text-sm"
                        autoFocus
                        data-testid={`input-edit-content-${note.id}`}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(note.id)}
                          data-testid={`button-save-edit-${note.id}`}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          data-testid={`button-cancel-edit-${note.id}`}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge variant="secondary" className={`text-xs ${config.color}`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {note.aiProvenance && (
                            <Badge variant="outline" className="text-xs">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI
                            </Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleStartEdit(note)}
                            data-testid={`button-edit-note-${note.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => onDeleteNote(note.id)}
                            data-testid={`button-delete-note-${note.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap" data-testid={`text-note-content-${note.id}`}>
                        {note.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {note.linkedAnnotationIds.length} linked annotation{note.linkedAnnotationIds.length !== 1 ? "s" : ""}
                      </p>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
