import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, MessageSquare, Bot, User } from "lucide-react";
import type { ResearchChatMessage } from "@shared/schema";

interface ResearchChatProps {
  paperId: string | null;
  messages: ResearchChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  onClearChat: () => void;
}

export function ResearchChat({
  paperId,
  messages,
  isLoading,
  streamingContent,
  onClearChat,
}: ResearchChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

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
          {messages.map((message) => (
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
              <div
                className={`rounded-lg p-2.5 max-w-[85%] text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.selectedText && message.role === "user" && (
                  <div className="text-xs opacity-80 mb-1.5 italic border-l-2 border-current pl-2">
                    "{message.selectedText.slice(0, 100)}
                    {message.selectedText.length > 100 ? "..." : ""}"
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
              {message.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                  <User className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {(isLoading || streamingContent) && (
            <div className="flex gap-2 justify-start" data-testid="chat-streaming">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="rounded-lg p-2.5 max-w-[85%] text-sm bg-muted">
                {streamingContent ? (
                  <div className="whitespace-pre-wrap break-words">
                    {streamingContent}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
