import { NextResponse, type NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { requireDatabase } from "@/lib/require-database"
import { isTestWorkspace } from "@/lib/app-mode"
import { messagingService } from "@/lib/services/messaging.service"
import { prisma, supabase } from "@/lib/db"

export const dynamic = "force-dynamic"

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

async function getDealerIdForUser(userId: string): Promise<string | undefined> {
  const { data: dealerUser } = await supabase.from("DealerUser").select("dealerId").eq("userId", userId).maybeSingle()
  if (dealerUser?.dealerId) return dealerUser.dealerId as string

  const { data: dealer } = await supabase.from("Dealer").select("id").eq("userId", userId).maybeSingle()
  return dealer?.id as string | undefined
}

/**
 * GET /api/dealer/messages/threads/[threadId] — get messages in a thread
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ threadId: string }> }) {
  try {
    const user = await requireAuth(["DEALER", "DEALER_USER"])
    const { threadId } = await ctx.params

    if (isTestWorkspace(user)) {
      return NextResponse.json({ success: true, data: { id: threadId, messages: [], readiness: null } })
    }
    const dbUnavailable = requireDatabase()
    if (dbUnavailable) return dbUnavailable

    const dealerId = await getDealerIdForUser(user.userId)
    if (!dealerId) return jsonError("Dealer not found", 404)

    // Verify thread belongs to dealer
    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
    })

    if (!thread || thread.dealerId !== dealerId) {
      return jsonError("Thread not found", 404)
    }

    const messages = await messagingService.listMessages(threadId, dealerId)
    const readiness = await messagingService.buildBuyerReadinessPayloadForMessaging(thread.buyerId)

    return NextResponse.json({
      success: true,
      data: {
        id: thread.id,
        buyerId: thread.identityReleased ? thread.buyerId : undefined,
        approvalType: thread.approvalType,
        identityReleased: thread.identityReleased,
        status: thread.status,
        readiness,
        messages: messages.map((m: any) => ({
          id: m.id,
          senderType: m.senderType,
          body: m.body,
          containsSensitiveData: m.containsSensitiveData,
          createdAt: m.createdAt,
          isMe: m.senderType === "DEALER",
        })),
      },
    })
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode === 401 || statusCode === 403) {
      return NextResponse.json({ error: (error as Error).message }, { status: statusCode })
    }
    return jsonError("Failed to load thread", 500)
  }
}
