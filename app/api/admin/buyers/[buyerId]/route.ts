import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser, isAdminRole } from "@/lib/auth-server"
import { createClient } from "@/lib/supabase/server"
import { isTestWorkspace } from "@/lib/app-mode"
import { mockSelectors } from "@/lib/mocks/mockStore"
import { randomUUID } from "crypto"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ buyerId: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { buyerId } = await params

    if (isTestWorkspace(user)) {
      const buyer = mockSelectors.adminBuyerDetail(buyerId)
      if (!buyer) {
        return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
      }
      return NextResponse.json({ buyer })
    }

    // Fail-closed: require workspace_id for non-test workspaces
    const wsId = user.workspace_id
    if (!wsId) {
      return NextResponse.json({ error: "Forbidden: no workspace" }, { status: 403 })
    }

    const supabase = await createClient()

    const { data: buyer, error } = await supabase
      .from("User")
      .select(`
        *,
        buyerProfile:BuyerProfile(*),
        buyerPreQualification:PreQualification(*),
        buyerPreferences:BuyerPreferences(*),
        shortlists:Shortlist(
          *,
          items:ShortlistItem(
            *,
            inventoryItem:InventoryItem(
              *,
              vehicle:Vehicle(*)
            )
          )
        ),
        auctions:Auction(
          *,
          offers:Offer(
            *,
            dealer:Dealer(*)
          )
        ),
        selectedDeals:SelectedDeal(
          *,
          dealer:Dealer(*),
          inventoryItem:InventoryItem(
            *,
            vehicle:Vehicle(*)
          ),
          serviceFee:ServiceFee(*),
          deposit:Deposit(*)
        ),
        affiliate:Affiliate(
          *,
          referrals:Referral(*),
          commissions:Commission(*)
        ),
        documents:Document(*),
        pickupAppointments:PickupAppointment(*),
        complianceEvents:ComplianceEvent(*),
        adminAuditLogs:AdminAuditLog(*)
      `)
      .eq("id", buyerId)
      .eq("workspaceId", wsId)
      .order("createdAt", { referencedTable: "auctions", ascending: false })
      .order("createdAt", { referencedTable: "selectedDeals", ascending: false })
      .single()

    if (error || !buyer) {
      console.error("[Admin Buyer Detail Error]", error)
      return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
    }

    return NextResponse.json({ buyer })
  } catch (error) {
    const correlationId = randomUUID()
    console.error("[Admin Buyer Detail Error]", { correlationId, error })
    return NextResponse.json({ error: "Failed to load buyer", correlationId }, { status: 500 })
  }
}
