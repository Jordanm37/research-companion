import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Trash2,
  MessageSquare,
  Bot,
  User,
  BookOpen,
  Search,
  Send,
  FileText,
  Plus,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ResearchChatMessage, NoteType } from "@shared/schema";

interface MatchedReference {
  rawText: string;
  authors?: string;
  year?: string;
  title?: string;
  index?: number;
}

interface ActiveToolUse {
  name: string;
  input: Record<string, unknown>;
}

interface ResearchChatProps {
  paperId: string | null;
  messages: ResearchChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  matchedReference?: MatchedReference | null;
  currentActionType?: string | null;
  activeToolUse?: ActiveToolUse | null;
  onClearChat: () => void;
  onSendFollowUp?: (message: string) => void;
  onSaveAsNote?: (content: string, noteType: NoteType) => void;
  onAddPaperToLibrary?: (url: string, title?: string) => Promise<void>;
}

const noteTypeOptions: { value: NoteType; label: string }[] = [
  { value: "insight", label: "Insight" },
  { value: "summary", label: "Summary" },
  { value: "question", label: "Question" },
  { value: "finding", label: "Finding" },
  { value: "custom", label: "Custom" },
];

// Extract paper links from markdown content
function extractPaperLinks(content: string): Array<{ title: string; url: string }> {
  const links: Array<{ title: string; url: string }> = [];

  // Match markdown links: [Title](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const [, title, url] = match;
    // Filter for academic paper URLs
    if (
      url.includes("arxiv.org") ||
      url.includes("doi.org") ||
      url.includes("semanticscholar.org") ||
      url.includes("acm.org") ||
      url.includes("ieee.org")
    ) {
      links.push({ title, url });
    }
  }

  return links;
}

export function ResearchChat({
  paperId,
  messages,
  isLoading,
  streamingContent,
  matchedReference,
  currentActionType,
  activeToolUse,
  onClearChat,
  onSendFollowUp,
  onSaveAsNote,
  onAddPaperToLibrary,
}: ResearchChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [selectedNoteType, setSelectedNoteType] = useState<NoteType>("insight");
  const [addingPaperUrl, setAddingPaperUrl] = useState<string | null>(null);
  const [addedPaperUrls, setAddedPaperUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSendFollowUp = () => {
    if (followUpMessage.trim() && onSendFollowUp) {
      onSendFollowUp(followUpMessage.trim());
      setFollowUpMessage("");
    }
  };

  const handleSaveAsNote = (messageId: string, content: string) => {
    if (onSaveAsNote) {
      onSaveAsNote(content, selectedNoteType);
      setSavingMessageId(null);
    }
  };

  const handleAddPaperToLibrary = async (url: string, title?: string) => {
    if (!onAddPaperToLibrary) return;

    setAddingPaperUrl(url);
    try {
      await onAddPaperToLibrary(url, title);
      setAddedPaperUrls((prev) => new Set(prev).add(url));
    } catch (error) {
      console.error("Failed to add paper:", error);
    } finally {
      setAddingPaperUrl(null);
    }
  };

  if (!paperId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <MessageSquare className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium mb-1" data-testid="text-no-paper-chat">
          No Paper Loaded
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload a PDF to start research conversations
        </p>
      </div>
    );
  }

  if (messages.length === 0 && !isLoading && !streamingContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Bot className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium mb-1" data-testid="text-empty-chat">
          Research Assistant
        </h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          Select text in the PDF and choose an action to start a conversation about the research
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b gap-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Research Chat
        </h3>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onClearChat}
          disabled={messages.length === 0}
          data-testid="button-clear-chat"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => {
            const paperLinks = message.role === "assistant" ? extractPaperLinks(message.content) : [];

            return (
              <div
                key={message.id}
                className={`flex gap-2 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
                data-testid={`chat-message-${message.id}`}
              >
                {message.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className="flex-1 max-w-[85%]">
                  <div
                    className={`rounded-lg p-2.5 text-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted"
                    }`}
                    style={{ width: message.role === "user" ? "fit-content" : "auto" }}
                  >
                    {message.selectedText && message.role === "user" && (
                      <div className="text-xs opacity-80 mb-1.5 italic border-l-2 border-current pl-2">
                        "{message.selectedText.slice(0, 100)}
                        {message.selectedText.length > 100 ? "..." : ""}"
                      </div>
                    )}
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {message.role === "assistant" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <span className="whitespace-pre-wrap">{message.content}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions for assistant messages */}
                  {message.role === "assistant" && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {/* Save as note */}
                      {onSaveAsNote && (
                        savingMessageId === message.id ? (
                          <div className="flex items-center gap-1">
                            <Select
                              value={selectedNoteType}
                              onValueChange={(v) => setSelectedNoteType(v as NoteType)}
                            >
                              <SelectTrigger className="h-6 text-xs w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {noteTypeOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 text-xs px-2"
                              onClick={() => handleSaveAsNote(message.id, message.content)}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs px-2"
                              onClick={() => setSavingMessageId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() => setSavingMessageId(message.id)}
                            data-testid={`button-save-note-${message.id}`}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Save as note
                          </Button>
                        )
                      )}

                      {/* Add discovered papers to library */}
                      {onAddPaperToLibrary && paperLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {paperLinks.slice(0, 3).map((link) => (
                            <Button
                              key={link.url}
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs px-2"
                              onClick={() => handleAddPaperToLibrary(link.url, link.title)}
                              disabled={addingPaperUrl === link.url || addedPaperUrls.has(link.url)}
                              data-testid={`button-add-paper-${link.url}`}
                            >
                              {addedPaperUrls.has(link.url) ? (
                                <>
                                  <Check className="w-3 h-3 mr-1 text-green-500" />
                                  Added
                                </>
                              ) : addingPaperUrl === link.url ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add to library
                                </>
                              )}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                    <User className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })}

          {(isLoading || streamingContent) && (
            <div className="flex gap-2 justify-start" data-testid="chat-streaming">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="rounded-lg p-2.5 max-w-[85%] text-sm bg-muted">
                {currentActionType === "paper_summary" && matchedReference && (
                  <div className="mb-2 p-2 bg-background/50 rounded border text-xs" data-testid="matched-reference">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <BookOpen className="w-3 h-3" />
                      <span className="font-medium">Matched Reference</span>
                    </div>
                    {matchedReference.title && (
                      <div className="font-medium text-foreground">{matchedReference.title}</div>
                    )}
                    {matchedReference.authors && (
                      <div className="text-muted-foreground">{matchedReference.authors}</div>
                    )}
                    {matchedReference.year && (
                      <div className="text-muted-foreground">{matchedReference.year}</div>
                    )}
                    {!matchedReference.title && !matchedReference.authors && (
                      <div className="text-muted-foreground italic line-clamp-2">{matchedReference.rawText}</div>
                    )}
                  </div>
                )}
                {currentActionType === "paper_summary" && matchedReference === null && isLoading && !streamingContent && !activeToolUse && (
                  <div className="mb-2 p-2 bg-background/50 rounded border text-xs text-muted-foreground" data-testid="no-matched-reference">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3" />
                      <span>No matching reference found in bibliography</span>
                    </div>
                  </div>
                )}
                {activeToolUse && (
                  <div className="mb-2 p-2 bg-primary/5 rounded border border-primary/20 text-xs" data-testid="active-tool-use">
                    <div className="flex items-center gap-1.5 text-primary mb-1">
                      <Search className="w-3 h-3" />
                      <span className="font-medium">
                        {activeToolUse.name === "search_papers"
                          ? "Searching Semantic Scholar..."
                          : activeToolUse.name === "get_paper_details"
                          ? "Getting paper details..."
                          : "Searching..."}
                      </span>
                      <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                    </div>
                    <div className="text-muted-foreground truncate">
                      {activeToolUse.input.query
                        ? `Query: ${String(activeToolUse.input.query)}`
                        : activeToolUse.input.paper_id
                        ? `Paper ID: ${String(activeToolUse.input.paper_id)}`
                        : ""}
                    </div>
                  </div>
                )}
                {streamingContent ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </ReactMarkdown>
                  </div>
                ) : !activeToolUse ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-2 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a follow-up question..."
            value={followUpMessage}
            onChange={(e) => setFollowUpMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendFollowUp();
              }
            }}
            disabled={isLoading || messages.length === 0}
            className="flex-1"
            data-testid="input-followup-message"
          />
          <Button
            size="icon"
            onClick={handleSendFollowUp}
            disabled={!followUpMessage.trim() || isLoading || messages.length === 0}
            data-testid="button-send-followup"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
