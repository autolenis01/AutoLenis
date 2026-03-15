import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { upgradeBuyerToPremium, getBuyerPackageState } from "@/lib/services/buyer-package.service"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const reason = typeof body.reason === "string" ? body.reason : null

    // Look up the buyer profile to get the profile id
    const supabase = await createClient()
    const { data: profile, error: profileError } = await supabase
      .from("BuyerProfile")
      .select("id, package_tier")
      .eq("userId", user.userId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Buyer profile not found" }, { status: 404 })
    }

    if (profile.package_tier === "PREMIUM") {
      return NextResponse.json({ error: "Already on Premium plan" }, { status: 409 })
    }

    // The RPC function uses the admin client internally
    await upgradeBuyerToPremium(profile.id, "DASHBOARD_UPGRADE", reason)

    return NextResponse.json({ success: true, message: "Upgraded to Premium" })
  } catch (error: any) {
    console.error("[Buyer Upgrade] Error:", error)
    return NextResponse.json(
      { error: "Failed to upgrade" },
      { status: 500 },
    )
  }
}
