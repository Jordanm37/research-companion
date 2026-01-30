import { useState, useCallback } from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { PdfViewer } from "@/components/PdfViewer"
import { SidePanel } from "@/components/SidePanel"
import { Header } from "@/components/Header"
import { usePaperManagement } from "@/hooks/usePaperManagement"
import { useAnnotations } from "@/hooks/useAnnotations"
import { useNotes } from "@/hooks/useNotes"
import { useResearchChat } from "@/hooks/useResearchChat"
import { useExport } from "@/hooks/useExport"
import { usePaperIngestion } from "@/hooks/usePaperIngestion"
import type { ResearchActionType, NoteType } from "@shared/schema"

export default function ReaderPage() {
  const [activeTab, setActiveTab] = useState("annotations")

  // Domain hooks
  const paperMgmt = usePaperManagement()
  const annotationMgmt = useAnnotations(paperMgmt.activePaperId)
  const noteMgmt = useNotes(paperMgmt.activePaperId)
  const researchChat = useResearchChat(paperMgmt.activePaperId)
  const exportMgmt = useExport(paperMgmt.activePaperId)
  const paperIngestion = usePaperIngestion()

  // Handle paper selection (clears annotation selection)
  const handleSelectPaper = useCallback(
    (paperId: string) => {
      paperMgmt.setActivePaperId(paperId)
      annotationMgmt.clearSelection()
    },
    [paperMgmt, annotationMgmt]
  )

  // Handle research action (switches tab and sends action)
  const handleResearchAction = useCallback(
    async (selectedText: string, actionType: ResearchActionType, customQuery?: string) => {
      setActiveTab("research")
      await researchChat.sendResearchAction(selectedText, actionType, customQuery)
    },
    [researchChat]
  )

  // Handle note creation (clears annotation selection after)
  const handleCreateNote = useCallback(
    (type: Parameters<typeof noteMgmt.createNote>[0], content: string, annotationIds: string[]) => {
      noteMgmt.createNote(type, content, annotationIds)
      annotationMgmt.clearSelection()
    },
    [noteMgmt, annotationMgmt]
  )

  // Handle saving chat response as a note
  const handleSaveAsNote = useCallback(
    (content: string, noteType: NoteType) => {
      noteMgmt.createNote(noteType, content, [])
    },
    [noteMgmt]
  )

  // Handle adding discovered paper to library
  const handleAddPaperToLibrary = useCallback(
    async (url: string, _title?: string) => {
      await paperIngestion.ingestPaper(url)
    },
    [paperIngestion]
  )

  const pdfUrl = paperMgmt.activePaperId ? `/api/papers/${paperMgmt.activePaperId}/pdf` : null

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        paperTitle={paperMgmt.activePaper?.title || paperMgmt.activePaper?.filename || null}
        paper={paperMgmt.activePaper}
        onUpload={paperMgmt.uploadPaper}
        onExport={exportMgmt.exportToObsidian}
        isExporting={exportMgmt.isExporting}
        vaultPath={exportMgmt.vaultPath}
        onVaultPathChange={exportMgmt.setVaultPath}
        onUpdatePaper={paperMgmt.updatePaper}
        isUpdatingPaper={paperMgmt.isUpdating}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={65} minSize={40}>
          <PdfViewer
            pdfUrl={pdfUrl}
            annotations={annotationMgmt.annotations}
            onCreateAnnotation={annotationMgmt.createAnnotation}
            highlightAnnotationId={annotationMgmt.highlightedAnnotationId}
            onAnnotationClick={annotationMgmt.clickAnnotation}
            onResearchAction={handleResearchAction}
            papers={paperMgmt.papers}
            onSelectPaper={handleSelectPaper}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={35} minSize={25}>
          <SidePanel
            annotations={annotationMgmt.annotations}
            notes={noteMgmt.notes}
            selectedAnnotationIds={annotationMgmt.selectedAnnotationIds}
            onToggleAnnotationSelect={annotationMgmt.toggleAnnotationSelect}
            onAnnotationClick={annotationMgmt.clickAnnotation}
            onUpdateAnnotationComment={annotationMgmt.updateAnnotationComment}
            highlightedAnnotationId={annotationMgmt.highlightedAnnotationId}
            onCreateNote={handleCreateNote}
            onUpdateNote={noteMgmt.updateNote}
            onDeleteNote={noteMgmt.deleteNote}
            onAIAction={noteMgmt.generateAIContent}
            isAILoading={noteMgmt.isAILoading}
            paperId={paperMgmt.activePaperId}
            researchChatMessages={researchChat.messages}
            isResearchChatLoading={researchChat.isLoading}
            researchChatStreamingContent={researchChat.streamingContent}
            matchedReference={researchChat.matchedReference}
            currentActionType={researchChat.currentActionType}
            activeToolUse={researchChat.activeToolUse}
            onClearResearchChat={researchChat.clearChat}
            onSendResearchFollowUp={researchChat.sendFollowUp}
            onSaveAsNote={handleSaveAsNote}
            onAddPaperToLibrary={handleAddPaperToLibrary}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
