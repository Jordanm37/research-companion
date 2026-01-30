import { useState, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import type { Annotation, BoundingBox, AnnotationType } from "@shared/schema"

export interface UseAnnotationsResult {
  annotations: Annotation[]
  selectedAnnotationIds: string[]
  highlightedAnnotationId: string | null
  createAnnotation: (
    pageIndex: number,
    boundingBox: BoundingBox,
    annotationType: AnnotationType,
    quotedText?: string
  ) => void
  toggleAnnotationSelect: (id: string) => void
  clickAnnotation: (id: string) => void
  updateAnnotationComment: (id: string, comment: string) => void
  clearSelection: () => void
}

export function useAnnotations(paperId: string | null): UseAnnotationsResult {
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([])
  const [highlightedAnnotationId, setHighlightedAnnotationId] = useState<string | null>(null)

  // Query annotations
  const { data: annotations = [] } = useQuery<Annotation[]>({
    queryKey: ["/api/papers", paperId, "annotations"],
    enabled: !!paperId,
  })

  // Create annotation mutation
  const createAnnotationMutation = useMutation({
    mutationFn: async (data: {
      paperId: string
      pageIndex: number
      boundingBox: BoundingBox
      annotationType: AnnotationType
      quotedText?: string
    }) => {
      return apiRequest("POST", `/api/papers/${data.paperId}/annotations`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", paperId, "annotations"] })
    },
  })

  // Update annotation mutation
  const updateAnnotationMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      return apiRequest("PATCH", `/api/annotations/${id}`, { comment })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers", paperId, "annotations"] })
    },
  })

  // Handlers
  const handleCreateAnnotation = useCallback(
    (
      pageIndex: number,
      boundingBox: BoundingBox,
      annotationType: AnnotationType,
      quotedText?: string
    ) => {
      if (!paperId) return
      createAnnotationMutation.mutate({
        paperId,
        pageIndex,
        boundingBox,
        annotationType,
        quotedText,
      })
    },
    [paperId, createAnnotationMutation]
  )

  const handleToggleAnnotationSelect = useCallback((id: string) => {
    setSelectedAnnotationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])

  const handleAnnotationClick = useCallback((id: string) => {
    setHighlightedAnnotationId(id)
    setTimeout(() => setHighlightedAnnotationId(null), 2000)
  }, [])

  const handleUpdateAnnotationComment = useCallback(
    (id: string, comment: string) => {
      updateAnnotationMutation.mutate({ id, comment })
    },
    [updateAnnotationMutation]
  )

  const clearSelection = useCallback(() => {
    setSelectedAnnotationIds([])
  }, [])

  return {
    annotations,
    selectedAnnotationIds,
    highlightedAnnotationId,
    createAnnotation: handleCreateAnnotation,
    toggleAnnotationSelect: handleToggleAnnotationSelect,
    clickAnnotation: handleAnnotationClick,
    updateAnnotationComment: handleUpdateAnnotationComment,
    clearSelection,
  }
}
