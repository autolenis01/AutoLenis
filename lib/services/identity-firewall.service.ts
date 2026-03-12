/**
 * Identity Firewall Service
 *
 * Scans messages for PII / identity leakage before identity release.
 * Detects phone numbers, emails, social handles, URLs, and street addresses.
 */

export interface IdentityScanResult {
  containsSensitiveData: boolean
  detections: IdentityDetection[]
  redactedText: string
}

export interface IdentityDetection {
  type: string
  original: string
  replacement: string
}

const REDACTED = "[REDACTED]"

// Patterns for identity information detection
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const SOCIAL_HANDLE_PATTERN = /(?:@[a-zA-Z0-9_]{2,30})|(?:(?:instagram|snapchat|whatsapp|telegram|facebook|fb|twitter|tiktok|venmo|cashapp|zelle)[\s:]*[a-zA-Z0-9_.@]+)/gi
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/gi
const ADDRESS_PATTERN = /\d{1,5}\s+(?:[a-zA-Z]+\s){1,4}(?:st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ln|lane|ct|court|way|pl|place)\b/gi
const CONTACT_EXCHANGE_PATTERN = /(?:(?:call|text|reach|contact|message|dm|hit)\s+(?:me|us)\s+(?:at|on|via|through))/gi

export class IdentityFirewallService {
  /**
   * Scan text for identity-leaking content and produce a redacted version.
   */
  scan(text: string): IdentityScanResult {
    const detections: IdentityDetection[] = []
    let redacted = text

    // Order matters: scan from most specific to least
    const patterns: Array<{ pattern: RegExp; type: string }> = [
      { pattern: EMAIL_PATTERN, type: "email" },
      { pattern: PHONE_PATTERN, type: "phone" },
      { pattern: URL_PATTERN, type: "url" },
      { pattern: SOCIAL_HANDLE_PATTERN, type: "social_handle" },
      { pattern: ADDRESS_PATTERN, type: "address" },
      { pattern: CONTACT_EXCHANGE_PATTERN, type: "contact_exchange" },
    ]

    for (const { pattern, type } of patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0
      let match: RegExpExecArray | null = null
      while ((match = pattern.exec(redacted)) !== null) {
        detections.push({
          type,
          original: match[0],
          replacement: REDACTED,
        })
      }
      redacted = redacted.replace(pattern, REDACTED)
    }

    return {
      containsSensitiveData: detections.length > 0,
      detections,
      redactedText: redacted,
    }
  }
}

export const identityFirewallService = new IdentityFirewallService()
