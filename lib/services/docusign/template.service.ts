/**
 * DocuSign Template Service
 *
 * Handles template operations: listing, retrieving, and validating
 * the dealer agreement template configuration.
 */

import { logger } from "@/lib/logger"
import {
  getDocuSignAuthConfig,
  isDocuSignConfigured,
  getDocuSignAccessToken,
} from "./auth.service"

/**
 * Verify the configured dealer agreement template exists in DocuSign.
 * Returns template metadata if found.
 */
export async function verifyDealerTemplate(): Promise<{
  templateId: string
  name: string
  exists: boolean
}> {
  const templateId = process.env.DOCUSIGN_DEALER_TEMPLATE_ID
  if (!templateId) {
    return { templateId: "", name: "", exists: false }
  }

  if (!isDocuSignConfigured()) {
    return { templateId, name: "", exists: false }
  }

  try {
    const config = getDocuSignAuthConfig()
    const accessToken = await getDocuSignAccessToken()

    const url = `${config.basePath}/v2.1/accounts/${config.accountId}/templates/${templateId}`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      logger.warn("DocuSign dealer template not found", { templateId, status: response.status })
      return { templateId, name: "", exists: false }
    }

    const data = await response.json()
    return {
      templateId,
      name: data.name || "",
      exists: true,
    }
  } catch (err) {
    logger.error("DocuSign template verification failed", { error: err })
    return { templateId, name: "", exists: false }
  }
}
