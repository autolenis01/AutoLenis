import { type NextRequest, NextResponse } from "next/server"
import { dealerOnboardingService } from "@/lib/services/dealer-onboarding"
import { dealerAgreementService } from "@/lib/services/dealer-agreement.service"
import { docuSignService } from "@/lib/services/dealer-onboarding/docusign.service"
import { logger } from "@/lib/logger"

/**
 * POST /api/webhooks/docusign
 *
 * DocuSign Connect webhook handler for dealer agreement events.
 * Handles: sent, delivered, completed, declined, voided.
 * Delegates to both legacy onboarding service and new agreement service.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Verify webhook signature if configured
    const signature = req.headers.get("x-docusign-signature-1") || ""
    if (signature && !docuSignService.verifyWebhookSignature(rawBody, signature)) {
      logger.warn("DocuSign webhook signature verification failed")
      return NextResponse.json(
        { error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" } },
        { status: 401 },
      )
    }

    const payload = JSON.parse(rawBody)
    const event = payload?.event
    const envelopeId = payload?.data?.envelopeId
    const envelopeStatus = payload?.data?.envelopeSummary?.status
    const eventTime = payload?.generatedDateTime || new Date().toISOString()

    if (!envelopeId) {
      return NextResponse.json(
        { error: { code: "MISSING_ENVELOPE_ID", message: "Missing envelope ID" } },
        { status: 400 },
      )
    }

    logger.info("DocuSign webhook received", { event, envelopeId })

    // Delegate to DealerAgreementService (new canonical handler)
    if (envelopeStatus) {
      await dealerAgreementService.processWebhookEvent(
        envelopeId,
        envelopeStatus,
        eventTime,
        payload as Record<string, unknown>,
      )
    }

    // Legacy: also handle via onboarding service for backward compat
    if (event === "envelope-completed") {
      await dealerOnboardingService.handleDocusignEnvelopeCompleted(envelopeId)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    logger.error("DocuSign webhook processing error", { error: err })
    return NextResponse.json(
      { error: { code: "WEBHOOK_ERROR", message: "Internal server error" } },
      { status: 500 },
    )
  }
}
