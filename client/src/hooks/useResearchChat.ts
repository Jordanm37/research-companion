import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import type { ResearchChatMessage, ResearchActionType } from "@shared/schema"

export interface MatchedReference {
  rawText: string
  authors?: string
  year?: string
  title?: string
  index?: number
}

export interface ActiveToolUse {
  name: string
  input: Record<string, unknown>
}

export interface UseResearchChatResult {
  messages: ResearchChatMessage[]
  isLoading: boolean
  streamingContent: string
  currentActionType: ResearchActionType | null
  matchedReference: MatchedReference | null
  activeToolUse: ActiveToolUse | null
  sendResearchAction: (
    selectedText: string,
    actionType: ResearchActionType,
    customQuery?: string
  ) => Promise<void>
  sendFollowUp: (message: string) => Promise<void>
  clearChat: () => Promise<void>
}

export function useResearchChat(paperId: string | null): UseResearchChatResult {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [currentActionType, setCurrentActionType] = useState<ResearchActionType | null>(null)
  const [matchedReference, setMatchedReference] = useState<MatchedReference | null>(null)
  const [activeToolUse, setActiveToolUse] = useState<ActiveToolUse | null>(null)

  // Query messages
  const { data: messages = [] } = useQuery<ResearchChatMessage[]>({
    queryKey: ["/api/papers", paperId, "research-chat"],
    enabled: !!paperId,
  })

  // Helper function to process SSE stream
  const processSSEStream = useCallback(
    async (response: Response, includeMatchedReference: boolean) => {
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let fullContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (includeMatchedReference && data.matchedReference !== undefined) {
                setMatchedReference(data.matchedReference)
              }
              if (data.toolUse) {
                setActiveToolUse(data.toolUse)
              }
              if (data.content) {
                setActiveToolUse(null)
                fullContent += data.content
                setStreamingContent(fullContent)
              }
              if (data.done) {
                setStreamingContent("")
                setMatchedReference(null)
                setCurrentActionType(null)
                setActiveToolUse(null)
                queryClient.invalidateQueries({
                  queryKey: ["/api/papers", paperId, "research-chat"],
                })
              }
              if (data.error) {
                throw new Error(data.error)
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    },
    [paperId]
  )

  // Send research action (initial action with text selection)
  const sendResearchAction = useCallback(
    async (selectedText: string, actionType: ResearchActionType, customQuery?: string) => {
      if (!paperId) return

      setIsLoading(true)
      setStreamingContent("")
      setCurrentActionType(actionType)
      setMatchedReference(null)
      setActiveToolUse(null)

      try {
        const response = await fetch(`/api/papers/${paperId}/research-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: customQuery || "",
            selectedText,
            actionType,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to send research query")
        }

        await processSSEStream(response, true)
      } catch {
        toast({
          title: "Research query failed",
          description: "Could not get AI response",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    },
    [paperId, processSSEStream, toast]
  )

  // Send follow-up message
  const sendFollowUp = useCallback(
    async (message: string) => {
      if (!paperId) return

      setIsLoading(true)
      setStreamingContent("")
      setCurrentActionType("custom_query")
      setMatchedReference(null)
      setActiveToolUse(null)

      try {
        const response = await fetch(`/api/papers/${paperId}/research-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: message,
            selectedText: "",
            actionType: "custom_query",
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to send follow-up message")
        }

        await processSSEStream(response, false)
      } catch {
        toast({
          title: "Follow-up failed",
          description: "Could not get AI response",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    },
    [paperId, processSSEStream, toast]
  )

  // Clear chat
  const clearChat = useCallback(async () => {
    if (!paperId) return

    try {
      await apiRequest("DELETE", `/api/papers/${paperId}/research-chat`, undefined)
      queryClient.invalidateQueries({
        queryKey: ["/api/papers", paperId, "research-chat"],
      })
    } catch {
      toast({
        title: "Clear failed",
        description: "Could not clear chat history",
        variant: "destructive",
      })
    }
  }, [paperId, toast])

  return {
    messages,
    isLoading,
    streamingContent,
    currentActionType,
    matchedReference,
    activeToolUse,
    sendResearchAction,
    sendFollowUp,
    clearChat,
  }
}
