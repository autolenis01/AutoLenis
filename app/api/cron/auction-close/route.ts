import { type NextRequest, NextResponse } from "next/server"
import { AuctionService } from "@/lib/services/auction.service"
import { validateCronRequest } from "@/lib/middleware/cron-security"
import { logger } from "@/lib/logger"

export async function GET(req: NextRequest) {
  try {
    const securityCheck = await validateCronRequest(req)
    if (securityCheck) {
      return securityCheck
    }

    logger.info("Starting auction auto-close cron job")

    const closedCount = await AuctionService.closeExpiredAuctions()

    logger.info("Auction auto-close cron job completed", { closedCount })

    return NextResponse.json({
      success: true,
      closedCount,
    })
  } catch (error) {
    logger.error("Auction auto-close cron job failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json(
      { success: false, error: "Cron job failed" },
      { status: 500 },
    )
  }
}
