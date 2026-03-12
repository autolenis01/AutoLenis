/**
 * Circumvention Monitor Service
 *
 * Detects attempts to take communication off-platform and bypass
 * the AutoLenis deal protection system.
 */

export interface CircumventionScanResult {
  score: number // 0-100
  flagged: boolean
  reasons: string[]
}

const CIRCUMVENTION_THRESHOLD = 60

// Keywords/phrases indicating attempts to move off-platform
const OFF_PLATFORM_KEYWORDS = [
  "meet me",
  "come to the lot",
  "outside of here",
  "off the app",
  "outside this",
  "directly",
  "deal on the side",
  "bypass",
  "skip the fee",
  "skip the middleman",
  "no commission",
  "go around",
  "private deal",
  "cut out",
  "without autolenis",
  "outside autolenis",
  "off platform",
]

export class CircumventionMonitorService {
  /**
   * Score a message for circumvention risk.
   * Returns a score from 0-100 and whether it exceeds threshold.
   */
  scan(text: string, containsSensitiveData: boolean): CircumventionScanResult {
    const lower = text.toLowerCase()
    const reasons: string[] = []
    let score = 0

    // PII detected by identity firewall adds base risk
    if (containsSensitiveData) {
      score += 40
      reasons.push("Message contains redacted PII")
    }

    // Check for off-platform intent keywords
    for (const keyword of OFF_PLATFORM_KEYWORDS) {
      if (lower.includes(keyword)) {
        score += 20
        reasons.push(`Off-platform language detected: "${keyword}"`)
      }
    }

    // Cap at 100
    score = Math.min(score, 100)

    return {
      score,
      flagged: score >= CIRCUMVENTION_THRESHOLD,
      reasons,
    }
  }
}

export const circumventionMonitorService = new CircumventionMonitorService()
