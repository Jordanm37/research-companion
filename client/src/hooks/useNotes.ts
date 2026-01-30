import { useState, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import type { NoteAtom, NoteType, AIActionType } from "@shared/schema"

export interface UseNotesResult {
  notes: NoteAtom[]
  isAILoading: boolean
  createNote: (type: NoteType, content: string, annotationIds: string[]) => void
  updateNote: (id: string, updates: { content?: string; noteType?: NoteType }) => void
  deleteNote: (id: string) => void
  generateAIContent: (
    actionType: AIActionType,
    annotationIds: string[],
    noteIds: string[]
  ) => Promise<string>
}

export function useNotes(paperId: string | null): UseNotesResult {
  const { toast } = useToast()
  const [isAILoading, setIsAILoading] = useState(false)

  // Query notes
  const { data: notes = [] } = useQuery<NoteAtom[]>({
    queryKey: ["/api/papers", paperId, "notes"],
    enabled: !!paperId,
  })

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (data: {
      paperId: string
      noteType: NoteType
      content: string
      linkedAnnotationIds: string[]
      outboundLinks: string[]
    }) => {
      return apiRequest("POST", `/api/papers/${data.paperId}/notes`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", paperId, "notes"] })
    },
  })

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: { content?: string; noteType?: NoteType }
    }) => {
      return apiRequest("PATCH", `/api/notes/${id}`, updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", paperId, "notes"] })
    },
  })

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/notes/${id}`, undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", paperId, "notes"] })
    },
  })

  // Handlers
  const handleCreateNote = useCallback(
    (type: NoteType, content: string, annotationIds: string[]) => {
      if (!paperId) return
      createNoteMutation.mutate({
        paperId,
        noteType: type,
        content,
        linkedAnnotationIds: annotationIds,
        outboundLinks: [],
      })
    },
    [paperId, createNoteMutation]
  )

  const handleUpdateNote = useCallback(
    (id: string, updates: { content?: string; noteType?: NoteType }) => {
      updateNoteMutation.mutate({ id, updates })
    },
    [updateNoteMutation]
  )

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteNoteMutation.mutate(id)
    },
    [deleteNoteMutation]
  )

  // AI action handler
  const handleAIAction = useCallback(
    async (
      actionType: AIActionType,
      annotationIds: string[],
      noteIds: string[]
    ): Promise<string> => {
      if (!paperId) return ""

      setIsAILoading(true)
      try {
        const response = await apiRequest("POST", `/api/papers/${paperId}/ai`, {
          actionType,
          annotationIds,
          noteAtomIds: noteIds,
        })
        const data = await response.json()
        return data.text || ""
      } catch {
        toast({
          title: "AI action failed",
          description: "Could not generate content",
          variant: "destructive",
        })
        return ""
      } finally {
        setIsAILoading(false)
      }
    },
    [paperId, toast]
  )

  return {
    notes,
    isAILoading,
    createNote: handleCreateNote,
    updateNote: handleUpdateNote,
    deleteNote: handleDeleteNote,
    generateAIContent: handleAIAction,
  }
}
