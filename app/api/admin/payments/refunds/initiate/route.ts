import { NextResponse } from "next/server"
import { getSessionUser, isAdminRole } from "@/lib/auth-server"
import { isTestWorkspace } from "@/lib/app-mode"
import { mockActions } from "@/lib/mocks/mockStore"
import { randomUUID } from "crypto"

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { buyerId, relatedPaymentId, relatedPaymentType, amount, reason } = body

    if (!buyerId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "buyerId and a positive amount are required" },
        { status: 400 },
      )
    }

    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required for refunds" },
        { status: 400 },
      )
    }

    if (isTestWorkspace(user)) {
      const record = mockActions.initiateRefund({
        buyerId,
        relatedPaymentId,
        relatedPaymentType,
        amount,
        reason,
        createdBy: user.userId,
      })
      return NextResponse.json({ success: true, data: record })
    }

    // Real implementation would:
    // 1. Create Refund record with workspaceInsert(user)
    // 2. Update related payment status if applicable
    // 3. Trigger buyer notification
    return NextResponse.json({ success: true, data: { id: randomUUID(), status: "PENDING" } })
  } catch (error) {
    console.error("[Admin Refund Initiate Error]", error)
    return NextResponse.json(
      { error: "Failed to initiate refund", correlationId: randomUUID() },
      { status: 500 },
    )
  }
}
