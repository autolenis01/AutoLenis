import { NextResponse } from "next/server"
import { InventoryService } from "@/lib/services/inventory.service"

export async function GET(request: Request) {
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
