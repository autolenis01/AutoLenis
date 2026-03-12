import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { InventoryService } from "@/lib/services/inventory.service"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET /api/buyer/inventory/search - Search inventory with budget filtering
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)

    // Parse filters from query params
    const filters = {
      makes: searchParams.get("makes")?.split(",").filter(Boolean),
      models: searchParams.get("models")?.split(",").filter(Boolean),
      bodyStyles: searchParams.get("bodyStyles")?.split(",").filter(Boolean),
      minYear: searchParams.get("minYear") ? Number.parseInt(searchParams.get("minYear")!, 10) : undefined,
      maxYear: searchParams.get("maxYear") ? Number.parseInt(searchParams.get("maxYear")!, 10) : undefined,
      minPriceCents: searchParams.get("minPrice")
        ? Number.parseInt(searchParams.get("minPrice")!, 10) * 100
        : undefined,
      maxPriceCents: searchParams.get("maxPrice")
        ? Number.parseInt(searchParams.get("maxPrice")!, 10) * 100
        : undefined,
      minMileage: searchParams.get("minMileage") ? Number.parseInt(searchParams.get("minMileage")!, 10) : undefined,
      maxMileage: searchParams.get("maxMileage") ? Number.parseInt(searchParams.get("maxMileage")!, 10) : undefined,
      isNew: searchParams.get("isNew") ? searchParams.get("isNew") === "true" : undefined,
      sortBy: searchParams.get("sortBy") as any,
      page: searchParams.get("page") ? Number.parseInt(searchParams.get("page")!, 10) : 1,
      pageSize: searchParams.get("pageSize") ? Number.parseInt(searchParams.get("pageSize")!, 10) : 20,
      budgetOnly: searchParams.get("budgetOnly") === "true",
    }

    // Get buyer's pre-qualification for budget filtering
    let buyerMaxOtdCents: number | undefined
    if (filters.budgetOnly) {
      const supabase = await createClient()

      const { data: prequal, error: prequalError } = await supabase
        .from("PreQualification")
        .select("maxOtdAmountCents, maxOtd")
        .eq("buyerId", user.userId)
        .gt("expiresAt", new Date().toISOString())
        .eq("prequalStatus", "APPROVED")
        .order("createdAt", { ascending: false })
        .limit(1)
        .single()

      if (prequalError) {
        console.error("[v0] Prequal fetch error:", prequalError)
      }

      if (prequal?.maxOtdAmountCents) {
        buyerMaxOtdCents = prequal.maxOtdAmountCents
      } else if (prequal?.maxOtd) {
        buyerMaxOtdCents = Math.round(prequal.maxOtd * 100)
      } else {
        return NextResponse.json(
          { error: "No active pre-qualification found. Please complete pre-qualification first." },
          { status: 400 },
        )
      }
    }

    const result = await InventoryService.search(filters, buyerMaxOtdCents)

    return NextResponse.json({
      success: true,
      ...result,
      budgetMaxOtdCents: buyerMaxOtdCents,
    })
  } catch (error) {
    console.error("[v0] Buyer search error:", error)
    return NextResponse.json({ error: "Failed to search inventory" }, { status: 500 })
  }
}
