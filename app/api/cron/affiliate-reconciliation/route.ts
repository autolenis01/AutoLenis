import { type NextRequest, NextResponse } from "next/server"
import { affiliateService } from "@/lib/services/affiliate.service"
import { validateCronRequest } from "@/lib/middleware/cron-security"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const securityCheck = await validateCronRequest(request)
    if (securityCheck) {
      return securityCheck
    }

    const results = await affiliateService.runReconciliation()

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error("Affiliate reconciliation cron job failed", error instanceof Error ? error : undefined)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
