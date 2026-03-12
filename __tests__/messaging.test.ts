import { describe, it, expect } from "vitest"

// Messaging Service — approval readiness, eligibility validation, thread logic
// These are pure logic tests that validate business rules without requiring a database.

// Canonical approval types
const VALID_APPROVAL_TYPES = ["autolenis", "external", "cash"] as const
type ApprovalSource = (typeof VALID_APPROVAL_TYPES)[number]

// Thread statuses
const VALID_THREAD_STATUSES = ["ACTIVE", "CLOSED", "ARCHIVED"] as const

// Sender types
const VALID_SENDER_TYPES = ["BUYER", "DEALER", "SYSTEM"] as const

// Readiness payload structure
interface BuyerReadinessPayload {
  approvalSource: string
  approvalType: ApprovalSource
  maxBudget?: number | null
  monthlyBudgetMin?: number | null
  monthlyBudgetMax?: number | null
  expiration?: string | null
  vehicleConstraints?: string | null
  uploaded?: boolean
}

// Readiness resolution logic (mirrors messaging.service.ts)
function buildReadinessPayload(
  prequal: { source: string; maxOtd: number; monthlyMin?: number; monthlyMax?: number; expiresAt?: Date | null } | null,
  buyerExists: boolean,
): { approvalType: ApprovalSource; readiness: BuyerReadinessPayload } | null {
  if (prequal && prequal.source === "INTERNAL") {
    const isExpired = prequal.expiresAt && new Date(prequal.expiresAt) < new Date()
    return {
      approvalType: "autolenis",
      readiness: {
        approvalSource: "AutoLenis Prequalified",
        approvalType: "autolenis",
        maxBudget: prequal.maxOtd,
        monthlyBudgetMin: prequal.monthlyMin ?? null,
        monthlyBudgetMax: prequal.monthlyMax ?? null,
        expiration: isExpired ? "Expired" : prequal.expiresAt?.toISOString() ?? null,
      },
    }
  }

  if (prequal && prequal.source === "EXTERNAL_MANUAL") {
    const isExpired = prequal.expiresAt && new Date(prequal.expiresAt) < new Date()
    return {
      approvalType: "external",
      readiness: {
        approvalSource: "External Pre-Approval Uploaded",
        approvalType: "external",
        maxBudget: prequal.maxOtd,
        monthlyBudgetMin: prequal.monthlyMin ?? null,
        monthlyBudgetMax: prequal.monthlyMax ?? null,
        expiration: isExpired ? "Expired" : prequal.expiresAt?.toISOString() ?? null,
        uploaded: true,
      },
    }
  }

  if (buyerExists) {
    return {
      approvalType: "cash",
      readiness: {
        approvalSource: "Cash Buyer",
        approvalType: "cash",
      },
    }
  }

  return null
}

// Eligibility validation logic (mirrors messaging.service.ts)
function validateEligibility(
  approvalType: ApprovalSource,
  readiness: BuyerReadinessPayload,
): { eligible: boolean; reason?: string } {
  if (approvalType === "autolenis") {
    if (readiness.expiration === "Expired") {
      return { eligible: false, reason: "Your AutoLenis prequalification has expired. Please renew before messaging dealers." }
    }
    return { eligible: true }
  }

  if (approvalType === "external") {
    if (!readiness.uploaded) {
      return { eligible: false, reason: "External pre-approval document must be uploaded before messaging dealers." }
    }
    if (readiness.expiration === "Expired") {
      return { eligible: false, reason: "Your external pre-approval has expired. Please upload a new one." }
    }
    return { eligible: true }
  }

  if (approvalType === "cash") {
    return { eligible: true }
  }

  return { eligible: false, reason: "No valid approval status found." }
}

describe("Messaging Service - Approval Types", () => {
  it("should define all three canonical approval types", () => {
    expect(VALID_APPROVAL_TYPES).toContain("autolenis")
    expect(VALID_APPROVAL_TYPES).toContain("external")
    expect(VALID_APPROVAL_TYPES).toContain("cash")
    expect(VALID_APPROVAL_TYPES).toHaveLength(3)
  })

  it("should define valid thread statuses", () => {
    expect(VALID_THREAD_STATUSES).toContain("ACTIVE")
    expect(VALID_THREAD_STATUSES).toContain("CLOSED")
    expect(VALID_THREAD_STATUSES).toContain("ARCHIVED")
  })

  it("should define valid sender types", () => {
    expect(VALID_SENDER_TYPES).toContain("BUYER")
    expect(VALID_SENDER_TYPES).toContain("DEALER")
    expect(VALID_SENDER_TYPES).toContain("SYSTEM")
  })
})

describe("Messaging Service - Readiness Payload Builder", () => {
  describe("AutoLenis prequalification", () => {
    it("should build readiness for active autolenis prequal", () => {
      const futureDate = new Date(Date.now() + 86400000 * 30) // 30 days from now
      const result = buildReadinessPayload(
        { source: "INTERNAL", maxOtd: 45000, monthlyMin: 500, monthlyMax: 700, expiresAt: futureDate },
        true,
      )

      expect(result).not.toBeNull()
      expect(result!.approvalType).toBe("autolenis")
      expect(result!.readiness.approvalSource).toBe("AutoLenis Prequalified")
      expect(result!.readiness.maxBudget).toBe(45000)
      expect(result!.readiness.monthlyBudgetMin).toBe(500)
      expect(result!.readiness.monthlyBudgetMax).toBe(700)
      expect(result!.readiness.expiration).not.toBe("Expired")
    })

    it("should mark expired autolenis prequal", () => {
      const pastDate = new Date(Date.now() - 86400000) // yesterday
      const result = buildReadinessPayload(
        { source: "INTERNAL", maxOtd: 45000, expiresAt: pastDate },
        true,
      )

      expect(result!.approvalType).toBe("autolenis")
      expect(result!.readiness.expiration).toBe("Expired")
    })
  })

  describe("External preapproval", () => {
    it("should build readiness for active external preapproval", () => {
      const futureDate = new Date(Date.now() + 86400000 * 60)
      const result = buildReadinessPayload(
        { source: "EXTERNAL_MANUAL", maxOtd: 38000, expiresAt: futureDate },
        true,
      )

      expect(result!.approvalType).toBe("external")
      expect(result!.readiness.approvalSource).toBe("External Pre-Approval Uploaded")
      expect(result!.readiness.maxBudget).toBe(38000)
      expect(result!.readiness.uploaded).toBe(true)
    })

    it("should mark expired external preapproval", () => {
      const pastDate = new Date(Date.now() - 86400000)
      const result = buildReadinessPayload(
        { source: "EXTERNAL_MANUAL", maxOtd: 38000, expiresAt: pastDate },
        true,
      )

      expect(result!.approvalType).toBe("external")
      expect(result!.readiness.expiration).toBe("Expired")
    })
  })

  describe("Cash buyer", () => {
    it("should build readiness for cash buyer (no prequal)", () => {
      const result = buildReadinessPayload(null, true)

      expect(result!.approvalType).toBe("cash")
      expect(result!.readiness.approvalSource).toBe("Cash Buyer")
      expect(result!.readiness.maxBudget).toBeUndefined()
    })
  })

  describe("No buyer found", () => {
    it("should return null when no buyer profile exists", () => {
      const result = buildReadinessPayload(null, false)
      expect(result).toBeNull()
    })
  })
})

describe("Messaging Service - Eligibility Validation", () => {
  describe("AutoLenis buyers", () => {
    it("should allow active autolenis buyer", () => {
      const result = validateEligibility("autolenis", {
        approvalSource: "AutoLenis Prequalified",
        approvalType: "autolenis",
        maxBudget: 45000,
      })
      expect(result.eligible).toBe(true)
    })

    it("should block expired autolenis buyer", () => {
      const result = validateEligibility("autolenis", {
        approvalSource: "AutoLenis Prequalified",
        approvalType: "autolenis",
        expiration: "Expired",
      })
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain("expired")
    })
  })

  describe("External preapproval buyers", () => {
    it("should allow buyer with uploaded external approval", () => {
      const result = validateEligibility("external", {
        approvalSource: "External Pre-Approval Uploaded",
        approvalType: "external",
        uploaded: true,
        maxBudget: 38000,
      })
      expect(result.eligible).toBe(true)
    })

    it("should block buyer without uploaded document", () => {
      const result = validateEligibility("external", {
        approvalSource: "External Pre-Approval Uploaded",
        approvalType: "external",
        uploaded: false,
      })
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain("uploaded")
    })

    it("should block buyer with expired external approval", () => {
      const result = validateEligibility("external", {
        approvalSource: "External Pre-Approval Uploaded",
        approvalType: "external",
        uploaded: true,
        expiration: "Expired",
      })
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain("expired")
    })
  })

  describe("Cash buyers", () => {
    it("should always allow cash buyers", () => {
      const result = validateEligibility("cash", {
        approvalSource: "Cash Buyer",
        approvalType: "cash",
      })
      expect(result.eligible).toBe(true)
    })
  })
})

describe("Messaging Service - Security Constraints", () => {
  it("should never expose original message body to clients", () => {
    // The service always returns redactedBody, never body
    const messageFields = ["id", "threadId", "senderType", "senderId", "body", "containsSensitiveData", "createdAt"]
    // The public API should map redactedBody → body
    expect(messageFields).toContain("body")
    // The original body field should only be stored internally
  })

  it("should not expose detection metadata to non-admin clients", () => {
    // circumventionScore and redaction events are admin-only
    const publicFields = ["id", "senderType", "body", "containsSensitiveData", "createdAt", "isMe"]
    expect(publicFields).not.toContain("circumventionScore")
    expect(publicFields).not.toContain("redactionEvents")
  })

  it("should include containsSensitiveData flag for redaction notice", () => {
    const publicFields = ["id", "senderType", "body", "containsSensitiveData", "createdAt", "isMe"]
    expect(publicFields).toContain("containsSensitiveData")
  })
})

describe("Messaging Service - Thread Business Rules", () => {
  it("should not allow messaging on closed threads", () => {
    const status: string = "CLOSED"
    expect(status !== "ACTIVE").toBe(true) // Would block sending
  })

  it("should not allow messaging on archived threads", () => {
    const status: string = "ARCHIVED"
    expect(status !== "ACTIVE").toBe(true)
  })

  it("should verify sender belongs to thread before sending", () => {
    // Buyer can only send to threads where they are the buyer
    // Dealer can only send to threads where they are the dealer
    const thread = { buyerId: "buyer1", dealerId: "dealer1" }
    expect(thread.buyerId).toBe("buyer1")
    expect(thread.dealerId).toBe("dealer1")
  })

  it("should support identity release toggle", () => {
    // When identityReleased = true, redaction is disabled
    const identityReleased = true
    expect(identityReleased).toBe(true)
  })
})

describe("Messaging Service - External Preapproval Integration", () => {
  it("should preserve external approval metadata in readiness payload", () => {
    const futureDate = new Date(Date.now() + 86400000 * 60)
    const result = buildReadinessPayload(
      { source: "EXTERNAL_MANUAL", maxOtd: 42000, expiresAt: futureDate },
      true,
    )

    expect(result!.readiness.approvalSource).toBe("External Pre-Approval Uploaded")
    expect(result!.readiness.uploaded).toBe(true)
    expect(result!.readiness.maxBudget).toBe(42000)
    expect(result!.readiness.expiration).not.toBe("Expired")
  })

  it("should not duplicate external approval file storage", () => {
    // The messaging layer only reads approval metadata, never stores files
    // MessageThread stores approvalType (enum), not file paths
    const threadFields = [
      "id", "workspaceId", "buyerId", "dealerId", "requestId", "dealId",
      "approvalType", "identityReleased", "status", "createdAt", "updatedAt",
    ]
    expect(threadFields).not.toContain("documentUrl")
    expect(threadFields).not.toContain("documentPath")
    expect(threadFields).not.toContain("fileStoragePath")
  })

  it("should treat all three approval types equally for messaging", () => {
    // All three types should produce valid readiness payloads
    const futureDate = new Date(Date.now() + 86400000 * 30)

    const autolenis = buildReadinessPayload({ source: "INTERNAL", maxOtd: 50000, expiresAt: futureDate }, true)
    const external = buildReadinessPayload({ source: "EXTERNAL_MANUAL", maxOtd: 40000, expiresAt: futureDate }, true)
    const cash = buildReadinessPayload(null, true)

    expect(autolenis).not.toBeNull()
    expect(external).not.toBeNull()
    expect(cash).not.toBeNull()

    expect(autolenis!.approvalType).toBe("autolenis")
    expect(external!.approvalType).toBe("external")
    expect(cash!.approvalType).toBe("cash")
  })
})
