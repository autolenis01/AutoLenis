"use client"

import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageSquare, Search, Send } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"
import { useMemo, useState } from "react"

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json())

export default function DealerMessagesPage() {
  const { data, isLoading } = useSWR("/api/dealer/messages", fetcher)
  const [search, setSearch] = useState("")

  const conversations: any[] = useMemo(() => {
    return data?.success ? data.data || [] : []
  }, [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (c) =>
        String(c.subject || "").toLowerCase().includes(q) ||
        String(c.lastMessage || "").toLowerCase().includes(q),
    )
  }, [conversations, search])

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" subtitle="Dealer support tickets (Dealer ↔ AutoLenis Admin)." />

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link href="/dealer/messages/new" className="inline-flex">
          <Button>New Ticket</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-10 bg-muted rounded animate-pulse" />
          <div className="h-10 bg-muted rounded animate-pulse" />
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-8 w-8 text-muted-foreground" />}
          title="No messages yet"
          description="Start a support ticket to get help from the AutoLenis team."
          primaryCta={{ label: "Create Ticket", href: "/dealer/messages/new" }}
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 h-[600px] overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y">
                {filtered.map((conv: any) => (
                  <Link
                    key={conv.id}
                    href={`/dealer/messages/${conv.id}`}
                    className="block p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{String(conv.subject || "S").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{conv.subject}</p>
                        <p className="text-sm text-muted-foreground truncate">{conv.lastMessage || ""}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 h-[600px] flex flex-col">
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a ticket to view messages</p>
              </div>
            </CardContent>
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input placeholder="Select a ticket to send messages" disabled aria-disabled="true" />
                <Button disabled aria-disabled="true">
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
