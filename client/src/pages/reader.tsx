import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { PdfViewer } from "@/components/PdfViewer";
import { SidePanel } from "@/components/SidePanel";
import { Header } from "@/components/Header";
import type { 
  Paper, 
  Annotation, 
  NoteAtom, 
  BoundingBox, 
  AnnotationType, 
  NoteType,
  AIActionType,
  ResearchChatMessage,
  ResearchActionType
} from "@shared/schema";

export default function ReaderPage() {
  const { toast } = useToast();
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([]);
  const [highlightedAnnotationId, setHighlightedAnnotationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("annotations");
  const [isResearchChatLoading, setIsResearchChatLoading] = useState(false);
  const [researchChatStreamingContent, setResearchChatStreamingContent] = useState("");
  const [currentActionType, setCurrentActionType] = useState<ResearchActionType | null>(null);
  const [matchedReference, setMatchedReference] = useState<{
    rawText: string;
    authors?: string;
    year?: string;
    title?: string;
    index?: number;
  } | null>(null);
  const [activeToolUse, setActiveToolUse] = useState<{
    name: string;
    input: Record<string, unknown>;
  } | null>(null);
  const [vaultPath, setVaultPath] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vaultPath") || "/obsidian-vault";
    }
    return "/obsidian-vault";
  });

  const { data: papers = [] } = useQuery<Paper[]>({
    queryKey: ["/api/papers"],
  });

  const activePaper = papers.find((p) => p.id === activePaperId);

  const { data: annotations = [] } = useQuery<Annotation[]>({
    queryKey: ["/api/papers", activePaperId, "annotations"],
    enabled: !!activePaperId,
  });

  const { data: notes = [] } = useQuery<NoteAtom[]>({
    queryKey: ["/api/papers", activePaperId, "notes"],
    enabled: !!activePaperId,
  });

  const { data: researchChatMessages = [] } = useQuery<ResearchChatMessage[]>({
    queryKey: ["/api/papers", activePaperId, "research-chat"],
    enabled: !!activePaperId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("pdf", file);
      const response = await fetch("/api/papers/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      return response.json();
    },
    onSuccess: (paper: Paper) => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers"] });
      setActivePaperId(paper.id);
      setSelectedAnnotationIds([]);
      toast({
        title: "PDF uploaded",
        description: `${paper.filename} has been loaded`,
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Could not upload the PDF file",
        variant: "destructive",
      });
    },
  });

  const createAnnotationMutation = useMutation({
    mutationFn: async (data: {
      paperId: string;
      pageIndex: number;
      boundingBox: BoundingBox;
      annotationType: AnnotationType;
      quotedText?: string;
    }) => {
      return apiRequest("POST", `/api/papers/${data.paperId}/annotations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", activePaperId, "annotations"] });
    },
  });

  const updateAnnotationMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      return apiRequest("PATCH", `/api/annotations/${id}`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", activePaperId, "annotations"] });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: {
      paperId: string;
      noteType: NoteType;
      content: string;
      linkedAnnotationIds: string[];
      outboundLinks: string[];
    }) => {
      return apiRequest("POST", `/api/papers/${data.paperId}/notes`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", activePaperId, "notes"] });
      setSelectedAnnotationIds([]);
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { content?: string; noteType?: NoteType } }) => {
      return apiRequest("PATCH", `/api/notes/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", activePaperId, "notes"] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/notes/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", activePaperId, "notes"] });
    },
  });

  const [isAILoading, setIsAILoading] = useState(false);

  const handleAIAction = useCallback(async (
    actionType: AIActionType,
    annotationIds: string[],
    noteIds: string[]
  ): Promise<string> => {
    if (!activePaperId) return "";
    
    setIsAILoading(true);
    try {
      const response = await apiRequest("POST", `/api/papers/${activePaperId}/ai`, {
        actionType,
        annotationIds,
        noteAtomIds: noteIds,
      });
      const data = await response.json();
      return data.text || "";
    } catch (error) {
      toast({
        title: "AI action failed",
        description: "Could not generate content",
        variant: "destructive",
      });
      return "";
    } finally {
      setIsAILoading(false);
    }
  }, [activePaperId, toast]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!activePaperId) return;

    setIsExporting(true);
    try {
      await apiRequest("POST", `/api/papers/${activePaperId}/export`, {
        vaultPath,
      });
      toast({
        title: "Export successful",
        description: "Markdown file has been written to your vault",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export to Obsidian vault",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }, [activePaperId, vaultPath, toast]);

  const handleCreateAnnotation = useCallback(
    (pageIndex: number, boundingBox: BoundingBox, annotationType: AnnotationType, quotedText?: string) => {
      if (!activePaperId) return;
      createAnnotationMutation.mutate({
        paperId: activePaperId,
        pageIndex,
        boundingBox,
        annotationType,
        quotedText,
      });
    },
    [activePaperId, createAnnotationMutation]
  );

  const handleToggleAnnotationSelect = useCallback((id: string) => {
    setSelectedAnnotationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleAnnotationClick = useCallback((id: string) => {
    setHighlightedAnnotationId(id);
    setTimeout(() => setHighlightedAnnotationId(null), 2000);
  }, []);

  const handleUpdateAnnotationComment = useCallback(
    (id: string, comment: string) => {
      updateAnnotationMutation.mutate({ id, comment });
    },
    [updateAnnotationMutation]
  );

  const handleCreateNote = useCallback(
    (type: NoteType, content: string, annotationIds: string[]) => {
      if (!activePaperId) return;
      createNoteMutation.mutate({
        paperId: activePaperId,
        noteType: type,
        content,
        linkedAnnotationIds: annotationIds,
        outboundLinks: [],
      });
    },
    [activePaperId, createNoteMutation]
  );

  const handleUpdateNote = useCallback(
    (id: string, updates: { content?: string; noteType?: NoteType }) => {
      updateNoteMutation.mutate({ id, updates });
    },
    [updateNoteMutation]
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteNoteMutation.mutate(id);
    },
    [deleteNoteMutation]
  );

  const handleVaultPathChange = useCallback((path: string) => {
    setVaultPath(path);
    if (typeof window !== "undefined") {
      localStorage.setItem("vaultPath", path);
    }
  }, []);

  const handleResearchAction = useCallback(async (
    selectedText: string,
    actionType: ResearchActionType,
    customQuery?: string
  ) => {
    if (!activePaperId) return;

    setActiveTab("research");
    setIsResearchChatLoading(true);
    setResearchChatStreamingContent("");
    setCurrentActionType(actionType);
    setMatchedReference(null);
    setActiveToolUse(null);

    try {
      const response = await fetch(`/api/papers/${activePaperId}/research-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: customQuery || "",
          selectedText,
          actionType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send research query");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.matchedReference !== undefined) {
                setMatchedReference(data.matchedReference);
              }
              if (data.toolUse) {
                setActiveToolUse(data.toolUse);
              }
              if (data.content) {
                setActiveToolUse(null);
                fullContent += data.content;
                setResearchChatStreamingContent(fullContent);
              }
              if (data.done) {
                setResearchChatStreamingContent("");
                setMatchedReference(null);
                setCurrentActionType(null);
                setActiveToolUse(null);
                queryClient.invalidateQueries({ 
                  queryKey: ["/api/papers", activePaperId, "research-chat"] 
                });
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      toast({
        title: "Research query failed",
        description: "Could not get AI response",
        variant: "destructive",
      });
    } finally {
      setIsResearchChatLoading(false);
    }
  }, [activePaperId, toast]);

  const handleClearResearchChat = useCallback(async () => {
    if (!activePaperId) return;

    try {
      await apiRequest("DELETE", `/api/papers/${activePaperId}/research-chat`, undefined);
      queryClient.invalidateQueries({ 
        queryKey: ["/api/papers", activePaperId, "research-chat"] 
      });
    } catch (error) {
      toast({
        title: "Clear failed",
        description: "Could not clear chat history",
        variant: "destructive",
      });
    }
  }, [activePaperId, toast]);

  const pdfUrl = activePaperId ? `/api/papers/${activePaperId}/pdf` : null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        paperTitle={activePaper?.title || activePaper?.filename || null}
        onUpload={(file) => uploadMutation.mutate(file)}
        onExport={handleExport}
        isExporting={isExporting}
        vaultPath={vaultPath}
        onVaultPathChange={handleVaultPathChange}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={65} minSize={40}>
          <PdfViewer
            pdfUrl={pdfUrl}
            annotations={annotations}
            onCreateAnnotation={handleCreateAnnotation}
            highlightAnnotationId={highlightedAnnotationId}
            onAnnotationClick={handleAnnotationClick}
            onResearchAction={handleResearchAction}
            papers={papers}
            onSelectPaper={(paperId) => {
              setActivePaperId(paperId);
              setSelectedAnnotationIds([]);
            }}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={35} minSize={25}>
          <SidePanel
            annotations={annotations}
            notes={notes}
            selectedAnnotationIds={selectedAnnotationIds}
            onToggleAnnotationSelect={handleToggleAnnotationSelect}
            onAnnotationClick={handleAnnotationClick}
            onUpdateAnnotationComment={handleUpdateAnnotationComment}
            highlightedAnnotationId={highlightedAnnotationId}
            onCreateNote={handleCreateNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onAIAction={handleAIAction}
            isAILoading={isAILoading}
            paperId={activePaperId}
            researchChatMessages={researchChatMessages}
            isResearchChatLoading={isResearchChatLoading}
            researchChatStreamingContent={researchChatStreamingContent}
            matchedReference={matchedReference}
            currentActionType={currentActionType}
            activeToolUse={activeToolUse}
            onClearResearchChat={handleClearResearchChat}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
