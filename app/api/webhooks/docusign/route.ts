import { type NextRequest, NextResponse } from "next/server"
import { dealerOnboardingService } from "@/lib/services/dealer-onboarding"
import { docuSignService } from "@/lib/services/dealer-onboarding/docusign.service"
import { logger } from "@/lib/logger"

/**
 * POST /api/webhooks/docusign
 *
 * DocuSign Connect webhook handler for dealer agreement events.
 * Handles: sent, delivered, completed, declined, voided.
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

    if (!envelopeId) {
      return NextResponse.json(
        { error: { code: "MISSING_ENVELOPE_ID", message: "Missing envelope ID" } },
        { status: 400 },
      )
    }

    logger.info("DocuSign webhook received", { event, envelopeId })

    switch (event) {
      case "envelope-completed":
        await dealerOnboardingService.handleDocusignEnvelopeCompleted(envelopeId)
        break

      case "envelope-sent":
      case "envelope-delivered":
        // Informational — no action needed beyond logging
        logger.info("DocuSign envelope status update", { event, envelopeId })
        break

      case "envelope-declined":
      case "envelope-voided":
        logger.warn("DocuSign envelope declined/voided", { event, envelopeId })
        break

      default:
        logger.info("DocuSign webhook event not handled", { event, envelopeId })
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
