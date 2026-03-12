import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { supabase } from "@/lib/db"
import { requireDatabase } from "@/lib/require-database"

export const dynamic = "force-dynamic"

// Get inventory
export async function GET(_req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !["DEALER", "DEALER_USER"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dbUnavailable = requireDatabase()
    if (dbUnavailable) return dbUnavailable

    const { data: dealer, error: dealerError } = await supabase
      .from("Dealer")
      .select("id, businessName, verified")
      .eq("userId", user.userId)
      .maybeSingle()

    if (dealerError) {
      console.error("[v0] Dealer lookup error:", dealerError)
      return NextResponse.json({ error: "Failed to fetch dealer" }, { status: 500 })
    }

    if (!dealer) {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 })
    }

    const { data: inventory, error: inventoryError } = await supabase
      .from("InventoryItem")
      .select(`
        id,
        price,
        status,
        createdAt,
        updatedAt,
        vehicle:Vehicle (
          id,
          vin,
          year,
          make,
          model,
          trim,
          bodyStyle,
          mileage,
          exteriorColor,
          interiorColor,
          transmission,
          fuelType,
          images
        )
      `)
      .eq("dealerId", dealer.id)
      .order("createdAt", { ascending: false })

    if (inventoryError) {
      console.error("[v0] Inventory fetch error:", inventoryError)
      return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 })
    }

    return NextResponse.json({ success: true, inventory: inventory || [] })
  } catch (error) {
    console.error("[v0] Inventory error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Add vehicle to inventory
export async function POST(_req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !["DEALER", "DEALER_USER"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dbCheck = requireDatabase()
    if (dbCheck) return dbCheck

    const { data: dealer, error: dealerError } = await supabase
      .from("Dealer")
      .select("id, businessName")
      .eq("userId", user.userId)
      .maybeSingle()

    if (dealerError || !dealer) {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 })
    }

    const body = await _req.json()
    const {
      vin,
      year,
      make,
      model,
      trim,
      bodyStyle,
      mileage,
      exteriorColor,
      interiorColor,
      transmission,
      fuelType,
      images,
      price,
    } = body

    if (!vin || !year || !make || !model || !bodyStyle || !mileage || !price) {
      return NextResponse.json(
        {
          error: "Missing required fields: vin, year, make, model, bodyStyle, mileage, price",
        },
        { status: 400 },
      )
    }

    const { data: existingVehicle } = await supabase.from("Vehicle").select("id").eq("vin", vin).maybeSingle()

    let vehicleId: string

    if (existingVehicle) {
      vehicleId = existingVehicle.id
    } else {
      const { data: newVehicle, error: vehicleError } = await supabase
        .from("Vehicle")
        .insert({
          vin,
          year,
          make,
          model,
          trim,
          bodyStyle,
          mileage,
          exteriorColor,
          interiorColor,
          transmission,
          fuelType,
          images: images || [],
        })
        .select("id")
        .single()

      if (vehicleError || !newVehicle) {
        console.error("[v0] Vehicle creation error:", vehicleError)
        return NextResponse.json({ error: "Failed to create vehicle" }, { status: 500 })
      }

      vehicleId = newVehicle.id
    }

    const { data: inventoryItem, error: inventoryError } = await supabase
      .from("InventoryItem")
      .insert({
        dealerId: dealer.id,
        vehicleId,
        price,
        status: "AVAILABLE",
      })
      .select(`
        id,
        price,
        status,
        createdAt,
        vehicle:Vehicle (
          id,
          vin,
          year,
          make,
          model,
          trim,
          bodyStyle,
          mileage,
          exteriorColor,
          interiorColor,
          transmission,
          fuelType,
          images
        )
      `)
      .single()

    if (inventoryError || !inventoryItem) {
      console.error("[v0] Inventory creation error:", inventoryError)
      return NextResponse.json({ error: "Failed to add vehicle to inventory" }, { status: 500 })
    }

    return NextResponse.json({ success: true, inventoryItem })
  } catch (error) {
    console.error("[v0] Add inventory error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
