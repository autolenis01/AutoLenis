/**
 * DocuSign Auth Service — JWT Grant Authentication
 *
 * Implements the canonical DocuSign JWT Grant flow for server-to-server
 * access. Uses RSA private key to generate JWT assertion tokens.
 *
 * Includes token caching for efficiency: tokens are reused until
 * they are within 5 minutes of expiration.
 */

import crypto from "node:crypto"
import { logger } from "@/lib/logger"

// ---------------------------------------------------------------------------
// Token Cache
// ---------------------------------------------------------------------------

let cachedToken: string | null = null
let cachedTokenExpiresAt = 0

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function getDocuSignAuthConfig() {
  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || "",
    userId: process.env.DOCUSIGN_USER_ID || "",
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || "",
    authServer: process.env.DOCUSIGN_AUTH_SERVER || "account-d.docusign.com",
    privateKeyBase64: process.env.DOCUSIGN_PRIVATE_KEY_BASE64 || "",
    basePath: process.env.DOCUSIGN_BASE_PATH || process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi",
    // Legacy fallback for secret-key-based auth (client_credentials)
    secretKey: process.env.DOCUSIGN_SECRET_KEY || "",
    oauthBaseUrl: process.env.DOCUSIGN_OAUTH_BASE_URL || "https://account-d.docusign.com",
  }
}

export function isDocuSignConfigured(): boolean {
  const c = getDocuSignAuthConfig()
  const hasJwt = !!(c.integrationKey && c.userId && c.privateKeyBase64 && c.accountId)
  const hasLegacy = !!(c.integrationKey && c.secretKey && c.accountId)
  return hasJwt || hasLegacy
}

// ---------------------------------------------------------------------------
// JWT Grant Auth
// ---------------------------------------------------------------------------

function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Construct and sign a DocuSign JWT assertion using the RSA private key.
 */
function buildJwtAssertion(
  integrationKey: string,
  userId: string,
  authServer: string,
  privateKeyPem: string,
): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 3600 // 1 hour validity

  const header = { typ: "JWT", alg: "RS256" }
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: authServer,
    iat: now,
    exp,
    scope: "signature impersonation",
  }

  const headerB64 = base64url(Buffer.from(JSON.stringify(header)))
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  const sign = crypto.createSign("RSA-SHA256")
  sign.update(signingInput)
  const signature = base64url(sign.sign(privateKeyPem))

  return `${signingInput}.${signature}`
}

/**
 * Request an access token from DocuSign using JWT Grant.
 *
 * Falls back to client_credentials grant if no RSA private key is available
 * (legacy configuration).
 */
export async function getDocuSignAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 300_000) {
    return cachedToken
  }

  const config = getDocuSignAuthConfig()

  // Prefer JWT Grant when RSA key is available
  if (config.privateKeyBase64 && config.userId) {
    return getTokenViaJwtGrant(config)
  }

  // Fallback: client_credentials with secret key
  if (config.secretKey) {
    return getTokenViaClientCredentials(config)
  }

  throw new Error("DocuSign authentication not configured. Set DOCUSIGN_PRIVATE_KEY_BASE64 + DOCUSIGN_USER_ID, or DOCUSIGN_SECRET_KEY.")
}

async function getTokenViaJwtGrant(config: ReturnType<typeof getDocuSignAuthConfig>): Promise<string> {
  const privateKeyPem = Buffer.from(config.privateKeyBase64, "base64").toString("utf-8")

  const assertion = buildJwtAssertion(
    config.integrationKey,
    config.userId,
    config.authServer,
    privateKeyPem,
  )

  const tokenUrl = `https://${config.authServer}/oauth/token`

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  })

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error("DocuSign JWT Grant token request failed", { status: response.status })
    throw new Error(`DocuSign JWT Grant error: ${response.status} — ${errorText}`)
  }

  const data = await response.json()

  cachedToken = data.access_token
  cachedTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000

  return data.access_token
}

async function getTokenViaClientCredentials(config: ReturnType<typeof getDocuSignAuthConfig>): Promise<string> {
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
    logger.error("DocuSign client_credentials token request failed", { status: response.status })
    throw new Error(`DocuSign OAuth error: ${response.status} — ${errorText}`)
  }

  const data = await response.json()

  cachedToken = data.access_token
  cachedTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000

  return data.access_token
}

/**
 * Clear the cached token (useful for testing or forced re-auth).
 */
export function clearTokenCache(): void {
  cachedToken = null
  cachedTokenExpiresAt = 0
}
