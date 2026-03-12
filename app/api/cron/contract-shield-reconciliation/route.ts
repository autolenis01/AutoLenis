import { type NextRequest, NextResponse } from "next/server"
import { ContractShieldService } from "@/lib/services/contract-shield.service"
import { validateCronRequest } from "@/lib/middleware/cron-security"
import { logger } from "@/lib/logger"

export async function GET(req: NextRequest) {
  try {
    const securityCheck = await validateCronRequest(req)
    if (securityCheck) {
      return securityCheck
    }

    logger.info("Starting Contract Shield reconciliation cron job")

    // Run all reconciliation jobs
    await Promise.all([
      ContractShieldService.runReconciliationJob("SYNC_STATUSES"),
      ContractShieldService.runReconciliationJob("CHECK_STALE_SCANS"),
      ContractShieldService.runReconciliationJob("NOTIFY_PENDING"),
    ])

    logger.info("Contract Shield reconciliation cron job completed")

    return NextResponse.json({
      success: true,
      message: "Reconciliation jobs completed",
    })
  } catch (error) {
    logger.error("Contract Shield reconciliation cron job failed", error instanceof Error ? error : undefined)

    return NextResponse.json(
      { error: "Reconciliation failed" },
      { status: 500 },
    )
  }
}
