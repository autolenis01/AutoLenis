"use client"
import { use, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { MessageSquare, Send } from "lucide-react"
import { csrfHeaders } from "@/lib/csrf-client"

export default function DealerMessageThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params)
  const [messages, setMessages] = useState<any[]>([])
  const [subject, setSubject] = useState<string>("")
  const [status, setStatus] = useState<string>("")
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchThread() {
      try {
        const res = await fetch(`/api/dealer/messages/${threadId}`, { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setMessages(data.data?.messages || [])
          setSubject(data.data?.subject || threadId)
          setStatus(data.data?.status || "")
        }
      } finally {
        setLoading(false)
      }
    }
    fetchThread()
  }, [threadId])

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dealer/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dealer/messages">Messages</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{threadId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{subject || "Conversation"}</span>
            {status ? <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">{status}</span> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p>No messages in this ticket yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs rounded-lg p-3 ${msg.isMe ? "bg-[#0066FF] text-white" : "bg-muted"}`}>
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-xs mt-1 ${msg.isMe ? "text-blue-100" : "text-muted-foreground"}`}>
                      {new Date(msg.time).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              placeholder={status === "CLOSED" ? "Ticket is closed" : "Type your message..."}
              className="flex-1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={status === "CLOSED" || sending}
            />
            <Button
              disabled={status === "CLOSED" || sending || !draft.trim()}
              onClick={async () => {
                setSending(true)
                try {
                  const res = await fetch(`/api/dealer/messages/${threadId}`, {
                    method: "POST",
                    headers: {
                      ...csrfHeaders(),
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ message: draft }),
                    credentials: "include",
                  })
                  if (!res.ok) return
                  setDraft("")
                  const r2 = await fetch(`/api/dealer/messages/${threadId}`, { credentials: "include" })
                  const d2 = await r2.json().catch(() => null)
                  setMessages(d2?.data?.messages || [])
                } finally {
                  setSending(false)
                }
              }}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
