import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser, isAdminRole } from "@/lib/auth-server"
import * as DealerSourceService from "@/lib/services/dealer-source.service"
import { randomUUID } from "crypto"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !isAdminRole(user.role))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const status = sp.get("status") || undefined
    const dealerId = sp.get("dealerId") || undefined
    const page = Number.parseInt(sp.get("page") || "1")

    const result = await DealerSourceService.getSources({ status, dealerId, page })
    return NextResponse.json(result)
  } catch (error) {
    const correlationId = randomUUID()
    console.error("[Admin Inventory Sources Error]", { correlationId, error })
    return NextResponse.json({ error: "Failed to list sources", correlationId }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !isAdminRole(user.role))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const source = await DealerSourceService.createSource(body)
    return NextResponse.json(source, { status: 201 })
  } catch (error) {
    const correlationId = randomUUID()
    console.error("[Admin Inventory Source Create Error]", { correlationId, error })
    return NextResponse.json({ error: "Failed to create source", correlationId }, { status: 500 })
  }
}
