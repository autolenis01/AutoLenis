import { describe, it, expect } from "vitest"
import { CircumventionMonitorService } from "@/lib/services/circumvention-monitor.service"

const service = new CircumventionMonitorService()

describe("Circumvention Monitor Service", () => {
  describe("Clean messages", () => {
    it("should score normal conversation as low risk", () => {
      const result = service.scan("I'm interested in the 2024 Camry", false)
      expect(result.score).toBe(0)
      expect(result.flagged).toBe(false)
      expect(result.reasons).toHaveLength(0)
    })

    it("should score pricing discussion as low risk", () => {
      const result = service.scan("Can you do $32,000 OTD?", false)
      expect(result.score).toBe(0)
      expect(result.flagged).toBe(false)
    })
  })

  describe("PII detection escalation", () => {
    it("should add base score when sensitive data is present", () => {
      const result = service.scan("Here is a normal message", true)
      expect(result.score).toBe(40)
      expect(result.flagged).toBe(false) // 40 < 60 threshold
      expect(result.reasons).toContain("Message contains redacted PII")
    })
  })

  describe("Off-platform language detection", () => {
    it("should flag 'meet me' language", () => {
      const result = service.scan("Let's meet me at the lot", false)
      expect(result.score).toBeGreaterThanOrEqual(20)
      expect(result.reasons.some((r) => r.includes("meet me"))).toBe(true)
    })

    it("should flag 'off the app' language", () => {
      const result = service.scan("Let's take this off the app", false)
      expect(result.score).toBeGreaterThanOrEqual(20)
    })

    it("should flag 'bypass' language", () => {
      const result = service.scan("We can bypass the platform fee", false)
      expect(result.score).toBeGreaterThanOrEqual(20)
    })

    it("should flag 'skip the fee' language", () => {
      const result = service.scan("Let me skip the fee and deal directly", false)
      expect(result.score).toBeGreaterThanOrEqual(40) // matches multiple keywords
    })

    it("should flag 'private deal' language", () => {
      const result = service.scan("We could do a private deal", false)
      expect(result.score).toBeGreaterThanOrEqual(20)
    })

    it("should flag 'without autolenis' language", () => {
      const result = service.scan("Let's handle this without autolenis", false)
      expect(result.score).toBeGreaterThanOrEqual(20)
    })
  })

  describe("Combined risk scoring", () => {
    it("should combine PII + circumvention language for high score", () => {
      const result = service.scan("Let's meet me outside of here", true)
      expect(result.score).toBeGreaterThanOrEqual(60)
      expect(result.flagged).toBe(true)
    })

    it("should cap score at 100", () => {
      const result = service.scan(
        "Let's meet me off the app and bypass directly without autolenis private deal",
        true,
      )
      expect(result.score).toBeLessThanOrEqual(100)
    })
  })

  describe("Threshold", () => {
    it("should flag messages at or above threshold", () => {
      // PII (40) + one keyword (20) = 60 = threshold
      const result = service.scan("Let's go off platform", true)
      expect(result.flagged).toBe(true)
    })

    it("should not flag messages below threshold", () => {
      const result = service.scan("Can we discuss pricing?", false)
      expect(result.flagged).toBe(false)
    })
  })
})
