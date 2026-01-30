import { useState, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import type { Paper } from "@shared/schema"
import type { UpdatePaper } from "@shared/types"

export interface UsePaperManagementResult {
  papers: Paper[]
  activePaperId: string | null
  activePaper: Paper | undefined
  setActivePaperId: (id: string | null) => void
  uploadPaper: (file: File) => void
  updatePaper: (updates: UpdatePaper) => Promise<void>
  isUploading: boolean
  isUpdating: boolean
}

export function usePaperManagement(): UsePaperManagementResult {
  const { toast } = useToast()
  const [activePaperId, setActivePaperId] = useState<string | null>(null)

  // Query for papers list
  const { data: papers = [] } = useQuery<Paper[]>({
    queryKey: ["/api/papers"],
  })

  // Active paper derived state
  const activePaper = papers.find((p) => p.id === activePaperId)

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("pdf", file)
      const response = await fetch("/api/papers/upload", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        throw new Error("Upload failed")
      }
      return response.json()
    },
    onSuccess: (paper: Paper) => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers"] })
      setActivePaperId(paper.id)
      toast({
        title: "PDF uploaded",
        description: `${paper.filename} has been loaded`,
      })
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Could not upload the PDF file",
        variant: "destructive",
      })
    },
  })

  // Update paper mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: UpdatePaper) => {
      if (!activePaperId) throw new Error("No active paper")
      const response = await fetch(`/api/papers/${activePaperId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        throw new Error("Update failed")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/papers"] })
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update paper details",
        variant: "destructive",
      })
    },
  })

  const handleUpload = useCallback(
    (file: File) => {
      uploadMutation.mutate(file)
    },
    [uploadMutation]
  )

  const handleUpdate = useCallback(
    async (updates: UpdatePaper) => {
      await updateMutation.mutateAsync(updates)
    },
    [updateMutation]
  )

  return {
    papers,
    activePaperId,
    activePaper,
    setActivePaperId,
    uploadPaper: handleUpload,
    updatePaper: handleUpdate,
    isUploading: uploadMutation.isPending,
    isUpdating: updateMutation.isPending,
  }
}
