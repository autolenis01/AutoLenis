/**
 * Document and Identity Trust Infrastructure — Identity Trust Service
 *
 * Manages canonical identity trust state for platform actors (buyers,
 * dealers, admins) including verification tracking and risk flags.
 */

import type {
  IdentityTrustRecord,
  IdentityTrustInput,
  IdentityTrustStatus,
  OwnerEntityType,
  VerificationSource,
} from "./types"
import {
  IdentityTrustStatus as TrustStatus,
} from "./types"

// ---------------------------------------------------------------------------
// In-Memory Store (replaced by Prisma/DB in production integration)
// ---------------------------------------------------------------------------

let identityStore: IdentityTrustRecord[] = []

export function resetIdentityStore(): void {
  identityStore = []
}

export function getIdentityStore(): ReadonlyArray<IdentityTrustRecord> {
  return identityStore
}

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

let idCounter = 0

function generateIdentityId(): string {
  idCounter++
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `idt_${timestamp}_${random}_${idCounter}`
}

// ---------------------------------------------------------------------------
// Identity Trust Operations
// ---------------------------------------------------------------------------

export interface IdentityWriteResult {
  success: boolean
  record: IdentityTrustRecord | null
  error: string | null
}

/**
 * Create or update an identity trust record.
 * If a record already exists for the entity, it is updated.
 */
export function upsertIdentityTrust(
  input: IdentityTrustInput
): IdentityWriteResult {
  if (!input.entityId) {
    return { success: false, record: null, error: "entityId is required" }
  }
  if (!input.entityType) {
    return { success: false, record: null, error: "entityType is required" }
  }

  const existing = identityStore.find(
    (r) =>
      r.entityId === input.entityId &&
      r.entityType === input.entityType
  )

  const now = new Date().toISOString()

  if (existing) {
    existing.trustFlags = input.trustFlags ?? existing.trustFlags
    existing.riskFlags = input.riskFlags ?? existing.riskFlags
    existing.verificationSource = input.verificationSource ?? existing.verificationSource
    existing.lastAssessedAt = now
    existing.updatedAt = now
    return { success: true, record: existing, error: null }
  }

  const record: IdentityTrustRecord = {
    id: generateIdentityId(),
    entityId: input.entityId,
    entityType: input.entityType,
    status: TrustStatus.UNVERIFIED,
    verificationSource: input.verificationSource ?? null,
    verifiedAt: null,
    verifierId: null,
    trustFlags: input.trustFlags ?? [],
    riskFlags: input.riskFlags ?? [],
    manualReviewRequired: false,
    kycStatus: null,
    kybStatus: null,
    lastAssessedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  identityStore.push(record)

  return { success: true, record, error: null }
}

/**
 * Mark an identity as verified.
 */
export function verifyIdentity(
  entityId: string,
  entityType: OwnerEntityType,
  verifierId: string,
  source: VerificationSource,
  metadata?: { kycStatus?: string; kybStatus?: string }
): IdentityWriteResult {
  const record = identityStore.find(
    (r) => r.entityId === entityId && r.entityType === entityType
  )

  if (!record) {
    return { success: false, record: null, error: "Identity record not found" }
  }

  const now = new Date().toISOString()
  record.status = TrustStatus.VERIFIED
  record.verifiedAt = now
  record.verifierId = verifierId
  record.verificationSource = source
  record.manualReviewRequired = false
  record.lastAssessedAt = now
  record.updatedAt = now

  if (metadata?.kycStatus) record.kycStatus = metadata.kycStatus
  if (metadata?.kybStatus) record.kybStatus = metadata.kybStatus

  return { success: true, record, error: null }
}

/**
 * Suspend an identity trust record.
 */
export function suspendIdentity(
  entityId: string,
  entityType: OwnerEntityType,
  reason: string
): IdentityWriteResult {
  const record = identityStore.find(
    (r) => r.entityId === entityId && r.entityType === entityType
  )

  if (!record) {
    return { success: false, record: null, error: "Identity record not found" }
  }

  const now = new Date().toISOString()
  record.status = TrustStatus.SUSPENDED
  record.riskFlags = [...record.riskFlags, reason]
  record.lastAssessedAt = now
  record.updatedAt = now

  return { success: true, record, error: null }
}

/**
 * Flag an identity for manual review.
 */
export function flagForManualReview(
  entityId: string,
  entityType: OwnerEntityType,
  flags: string[]
): IdentityWriteResult {
  const record = identityStore.find(
    (r) => r.entityId === entityId && r.entityType === entityType
  )

  if (!record) {
    return { success: false, record: null, error: "Identity record not found" }
  }

  const now = new Date().toISOString()
  record.manualReviewRequired = true
  record.riskFlags = [...new Set([...record.riskFlags, ...flags])]
  record.lastAssessedAt = now
  record.updatedAt = now

  return { success: true, record, error: null }
}

/**
 * Get the identity trust record for an entity.
 */
export function getIdentityTrust(
  entityId: string,
  entityType: OwnerEntityType
): IdentityTrustRecord | null {
  return (
    identityStore.find(
      (r) => r.entityId === entityId && r.entityType === entityType
    ) ?? null
  )
}

/**
 * Check if an entity's identity is verified.
 */
export function isIdentityVerified(
  entityId: string,
  entityType: OwnerEntityType
): boolean {
  const record = getIdentityTrust(entityId, entityType)
  return record?.status === TrustStatus.VERIFIED
}
