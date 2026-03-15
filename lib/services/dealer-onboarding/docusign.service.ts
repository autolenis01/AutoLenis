/**
 * DocuSign Service — Dealer Agreement Integration
 *
 * Handles DocuSign envelope creation, status checks, and webhook
 * processing for the Dealer Participation Agreement.
 *
 * Uses JWT Grant authentication (server-to-server).
 * All operations are idempotent where possible.
 */

import crypto from "node:crypto"

import { logger } from "@/lib/logger"
import { getDealerAgreementStoragePath } from "./types"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getDocuSignConfig() {
  return {
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || "",
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || "",
    secretKey: process.env.DOCUSIGN_SECRET_KEY || "",
    baseUrl: process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi",
    oauthBaseUrl: process.env.DOCUSIGN_OAUTH_BASE_URL || "https://account-d.docusign.com",
    dealerTemplateId: process.env.DOCUSIGN_DEALER_TEMPLATE_ID || "",
    webhookSecret: process.env.DOCUSIGN_WEBHOOK_SECRET || "",
  }
}

function isDocuSignConfigured(): boolean {
  const config = getDocuSignConfig()
  return !!(config.accountId && config.integrationKey && config.secretKey && config.dealerTemplateId)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateEnvelopeInput {
  applicationId: string
  signerEmail: string
  signerName: string
  legalBusinessName: string
  dealerLicenseNumber: string
  licenseState: string
  templateVersion?: string
}

export interface EnvelopeResult {
  envelopeId: string
  status: string
  sentAt: string
}

export interface EnvelopeStatusResult {
  envelopeId: string
  status: string
  sentDateTime: string | null
  completedDateTime: string | null
  declinedDateTime: string | null
  voidedDateTime: string | null
}

export interface WebhookPayload {
  event: string
  apiVersion: string
  uri: string
  retryCount: number
  configurationId: number
  generatedDateTime: string
  data: {
    accountId: string
    userId: string
    envelopeId: string
    envelopeSummary?: {
      status: string
      documentsUri: string
      recipientsUri: string
      envelopeUri: string
      emailSubject: string
      envelopeId: string
      sentDateTime?: string
      completedDateTime?: string
      declinedDateTime?: string
      voidedDateTime?: string
      statusChangedDateTime?: string
    }
  }
}

// ---------------------------------------------------------------------------
// DocuSign Service
// ---------------------------------------------------------------------------

export class DocuSignService {
  /**
   * Creates a DocuSign envelope from the dealer agreement template.
   * Sends the signing request to the dealer principal.
   */
  async createEnvelopeForDealerApplication(
    input: CreateEnvelopeInput,
  ): Promise<EnvelopeResult> {
    if (!isDocuSignConfigured()) {
      throw new Error("DocuSign is not configured. Set DOCUSIGN_* environment variables.")
    }

    const config = getDocuSignConfig()
    const accessToken = await this.getAccessToken()

    const url = `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes`

    const body = {
      templateId: config.dealerTemplateId,
      templateRoles: [
        {
          email: input.signerEmail,
          name: input.signerName,
          roleName: "Dealer Principal",
          tabs: {
            textTabs: [
              { tabLabel: "LegalBusinessName", value: input.legalBusinessName },
              { tabLabel: "DealerLicenseNumber", value: input.dealerLicenseNumber },
              { tabLabel: "LicenseState", value: input.licenseState },
            ],
          },
        },
      ],
      status: "sent",
      emailSubject: `AutoLenis Dealer Participation Agreement — ${input.legalBusinessName}`,
      eventNotification: {
        url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/webhooks/docusign`,
        requireAcknowledgment: "true",
        loggingEnabled: "true",
        envelopeEvents: [
          { envelopeEventStatusCode: "sent" },
          { envelopeEventStatusCode: "delivered" },
          { envelopeEventStatusCode: "completed" },
          { envelopeEventStatusCode: "declined" },
          { envelopeEventStatusCode: "voided" },
        ],
      },
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error("DocuSign envelope creation failed", {
        status: response.status,
        applicationId: input.applicationId,
      })
      throw new Error(`DocuSign API error: ${response.status} — ${errorText}`)
    }

    const data = await response.json()

    return {
      envelopeId: data.envelopeId,
      status: data.status,
      sentAt: new Date().toISOString(),
    }
  }

  /**
   * Gets the current status of a DocuSign envelope.
   */
  async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatusResult> {
    if (!isDocuSignConfigured()) {
      throw new Error("DocuSign is not configured.")
    }

    const config = getDocuSignConfig()
    const accessToken = await this.getAccessToken()

    const url = `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`DocuSign status check failed: ${response.status}`)
    }

    const data = await response.json()

    return {
      envelopeId: data.envelopeId,
      status: data.status,
      sentDateTime: data.sentDateTime || null,
      completedDateTime: data.completedDateTime || null,
      declinedDateTime: data.declinedDateTime || null,
      voidedDateTime: data.voidedDateTime || null,
    }
  }

  /**
   * Downloads the completed signed PDF from DocuSign.
   * Returns the PDF as a Buffer.
   */
  async downloadSignedDocument(envelopeId: string): Promise<Buffer> {
    if (!isDocuSignConfigured()) {
      throw new Error("DocuSign is not configured.")
    }

    const config = getDocuSignConfig()
    const accessToken = await this.getAccessToken()

    // Download combined (all documents merged into single PDF)
    const url = `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/combined`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/pdf",
      },
    })

    if (!response.ok) {
      throw new Error(`DocuSign document download failed: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  /**
   * Verifies the DocuSign webhook HMAC signature.
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const config = getDocuSignConfig()
    if (!config.webhookSecret) {
      logger.warn("DocuSign webhook secret not configured; skipping signature verification")
      return true
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", config.webhookSecret)
        .update(payload, "utf8")
        .digest("base64")

      // Timing-safe comparison
      const expectedBuffer = Buffer.from(expectedSignature, "base64")
      const receivedBuffer = Buffer.from(signature, "base64")

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    } catch (err) {
      logger.error("DocuSign webhook signature verification error", { error: err })
      return false
    }
  }

  /**
   * Returns the storage path for a signed dealer agreement.
   */
  getAgreementStoragePath(applicationId: string, envelopeId: string): string {
    return getDealerAgreementStoragePath(applicationId, envelopeId)
  }

  // ---------------------------------------------------------------------------
  // Private: OAuth2 JWT Grant
  // ---------------------------------------------------------------------------

  private async getAccessToken(): Promise<string> {
    const config = getDocuSignConfig()

    const url = `${config.oauthBaseUrl}/oauth/token`

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.integrationKey,
      client_secret: config.secretKey,
      scope: "signature",
    })

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error("DocuSign OAuth token request failed", { status: response.status })
      throw new Error(`DocuSign OAuth error: ${response.status} — ${errorText}`)
    }

    const data = await response.json()
    return data.access_token
  }
}

export const docuSignService = new DocuSignService()
