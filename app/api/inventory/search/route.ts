import { type NextRequest, NextResponse } from "next/server"
import { InventoryService } from "@/lib/services/inventory.service"
import { rateLimit, rateLimits } from "@/lib/middleware/rate-limit"

export async function GET(request: NextRequest) {
  // Rate limit: 100 requests per minute per IP to prevent scraping
  const rateLimitResponse = await rateLimit(request, rateLimits.api)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      makes: searchParams.get("makes")?.split(",").filter(Boolean),
      bodyStyles: searchParams.get("bodyStyles")?.split(",").filter(Boolean),
      minYear: searchParams.get("minYear") ? Number.parseInt(searchParams.get("minYear")!) : undefined,
      maxYear: searchParams.get("maxYear") ? Number.parseInt(searchParams.get("maxYear")!) : undefined,
      maxMileage: searchParams.get("maxMileage") ? Number.parseInt(searchParams.get("maxMileage")!) : undefined,
      maxPrice: searchParams.get("maxPrice") ? Number.parseFloat(searchParams.get("maxPrice")!) : undefined,
      minPrice: searchParams.get("minPrice") ? Number.parseFloat(searchParams.get("minPrice")!) : undefined,
    }

    const items = await InventoryService.search(filters)

    return NextResponse.json({
      success: true,
      data: { items },
    })
  } catch (error: any) {
    console.error("[Inventory Search]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
