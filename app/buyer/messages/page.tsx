"use client"

import { ProtectedRoute } from "@/components/layout/protected-route"
import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageSquare, Search, Send } from "lucide-react"
// import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"

export default function BuyerMessagesPage() {
  const conversations: any[] = []
  // const _searchParams = useSearchParams()

  return (
    <ProtectedRoute allowedRoles={["BUYER"]}>
      <Suspense fallback={<Loading />}>
        <div className="space-y-6">
          <PageHeader
            title="Messages"
            subtitle="Communicate with dealers and support"
          />

          {/* Search */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search conversations..." className="pl-9" />
            </div>
          </div>

          {/* Conversations */}
          {conversations.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-8 w-8 text-muted-foreground" />}
              title="No messages yet"
              description="When you start communicating with dealers about offers, your conversations will appear here."
              primaryCta={{ label: "Browse Vehicles", href: "/buyer/search" }}
            />
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Conversation List */}
              <Card className="lg:col-span-1 h-[600px] overflow-hidden">
                <CardContent className="p-0">
                  <div className="divide-y">
                    {conversations.map((conv: any) => (
                      <div
                        key={conv.id}
                        className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{conv.name?.[0] || "D"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{conv.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.lastMessage}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">{conv.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Message Area */}
              <Card className="lg:col-span-2 h-[600px] flex flex-col">
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to view messages</p>
                  </div>
                </CardContent>
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input placeholder="Type a message..." disabled />
                    <Button disabled>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </Suspense>
    </ProtectedRoute>
  )
}
