import { type NextRequest, NextResponse } from "next/server"
import { dealerAgreementService } from "@/lib/services/dealer-agreement.service"
import { verifyDocuSignHmac } from "@/lib/security/webhook-hmac"
import { logger } from "@/lib/logger"

/**
 * POST /api/docusign/connect
 *
 * Canonical DocuSign Connect webhook endpoint.
 * Receives envelope lifecycle events, verifies authenticity,
 * deduplicates via event hash, and routes to agreement service.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Verify webhook signature
    const connectSecret = process.env.DOCUSIGN_CONNECT_SECRET || process.env.DOCUSIGN_WEBHOOK_SECRET || ""
    const signature = req.headers.get("x-docusign-signature-1") || ""

    if (connectSecret && signature) {
      if (!verifyDocuSignHmac(rawBody, signature, connectSecret)) {
        logger.warn("DocuSign Connect webhook signature verification failed")
        return NextResponse.json(
          { error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" } },
          { status: 401 },
        )
      }
    }

    const payload = JSON.parse(rawBody)
    const envelopeId = payload?.data?.envelopeId
    const envelopeStatus = payload?.data?.envelopeSummary?.status
    const eventTime = payload?.generatedDateTime || new Date().toISOString()

    if (!envelopeId) {
      return NextResponse.json(
        { error: { code: "MISSING_ENVELOPE_ID", message: "Missing envelope ID" } },
        { status: 400 },
      )
    }

    logger.info("DocuSign Connect webhook received", {
      event: envelopeStatus,
      envelopeId,
    })

    // Process through the dealer agreement service
    const result = await dealerAgreementService.processWebhookEvent(
      envelopeId,
      envelopeStatus || "",
      eventTime,
      payload as Record<string, unknown>,
    )

    return NextResponse.json({ received: true, ...result })
  } catch (err) {
    logger.error("DocuSign Connect webhook processing error", { error: err })
    return NextResponse.json(
      { error: { code: "WEBHOOK_ERROR", message: "Internal server error" } },
      { status: 500 },
    )
  }
}
