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
  AIActionType 
} from "@shared/schema";

export default function ReaderPage() {
  const { toast } = useToast();
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([]);
  const [highlightedAnnotationId, setHighlightedAnnotationId] = useState<string | null>(null);
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
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
