/**
 * Document and Identity Trust Infrastructure — Document Trust Service
 *
 * Manages canonical trust records for platform documents with:
 * - Version control and hash integrity
 * - Verification and approval workflows
 * - Supersession chain management
 * - Active-for-decision tracking
 * - Revocation handling
 */

import type {
  DocumentTrustRecord,
  DocumentTrustInput,
  DocumentVerificationInput,
  DocumentTrustStatus,
  TrustDocumentType,
  OwnerEntityType,
} from "./types"
import {
  DocumentTrustStatus as TrustStatus,
  AccessScope,
} from "./types"

// ---------------------------------------------------------------------------
// In-Memory Store (replaced by Prisma/DB in production integration)
// ---------------------------------------------------------------------------

let documentStore: DocumentTrustRecord[] = []

export function resetDocumentStore(): void {
  documentStore = []
}

export function getDocumentStore(): ReadonlyArray<DocumentTrustRecord> {
  return documentStore
}

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

let docCounter = 0

function generateDocId(): string {
  docCounter++
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `doc_${timestamp}_${random}_${docCounter}`
}

// ---------------------------------------------------------------------------
// Document Trust Operations
// ---------------------------------------------------------------------------

export interface DocumentWriteResult {
  success: boolean
  record: DocumentTrustRecord | null
  error: string | null
}

/**
 * Create a trust record for a new document upload.
 * Automatically sets version = 1 for first document or increments for
 * existing documents of the same type/owner.
 */
export function createDocumentTrustRecord(
  input: DocumentTrustInput
): DocumentWriteResult {
  // Validate required fields
  if (!input.ownerEntityId) {
    return { success: false, record: null, error: "ownerEntityId is required" }
  }
  if (!input.documentType) {
    return { success: false, record: null, error: "documentType is required" }
  }
  if (!input.fileHash) {
    return { success: false, record: null, error: "fileHash is required" }
  }
  if (!input.uploaderId) {
    return { success: false, record: null, error: "uploaderId is required" }
  }
  if (!input.storageReference) {
    return { success: false, record: null, error: "storageReference is required" }
  }

  // Determine version number based on existing records
  const existingDocs = documentStore.filter(
    (d) =>
      d.ownerEntityId === input.ownerEntityId &&
      d.ownerEntityType === input.ownerEntityType &&
      d.documentType === input.documentType
  )
  const versionNumber = existingDocs.length + 1

  // Mark previous active versions as superseded
  for (const existing of existingDocs) {
    if (existing.activeForDecision) {
      existing.activeForDecision = false
      existing.status = TrustStatus.SUPERSEDED
      existing.updatedAt = new Date().toISOString()
    }
  }

  const now = new Date().toISOString()
  const record: DocumentTrustRecord = {
    id: generateDocId(),
    ownerEntityId: input.ownerEntityId,
    ownerEntityType: input.ownerEntityType,
    documentType: input.documentType,
    storageSource: input.storageSource,
    storageReference: input.storageReference,
    uploadTimestamp: now,
    uploaderId: input.uploaderId,
    fileHash: input.fileHash,
    versionNumber,
    status: TrustStatus.UPLOADED,
    verificationMetadata: null,
    verifierId: null,
    verifiedAt: null,
    supersededById: null,
    revocationReason: null,
    revokedAt: null,
    revokedById: null,
    activeForDecision: true,
    accessScope: input.accessScope ?? AccessScope.DEAL_PARTIES,
    createdAt: now,
    updatedAt: now,
  }

  // Update supersession chain on previous version
  if (existingDocs.length > 0) {
    const previousVersion = existingDocs[existingDocs.length - 1]
    previousVersion.supersededById = record.id
    previousVersion.updatedAt = now
  }

  documentStore.push(record)

  return { success: true, record, error: null }
}

/**
 * Verify/approve a document trust record.
 */
export function verifyDocument(
  input: DocumentVerificationInput
): DocumentWriteResult {
  const record = documentStore.find((d) => d.id === input.documentId)
  if (!record) {
    return { success: false, record: null, error: "Document not found" }
  }

  // Cannot verify superseded, revoked, or expired documents
  const nonVerifiableStatuses: DocumentTrustStatus[] = [
    TrustStatus.SUPERSEDED,
    TrustStatus.REVOKED,
    TrustStatus.EXPIRED,
  ]
  if (nonVerifiableStatuses.includes(record.status)) {
    return {
      success: false,
      record: null,
      error: `Cannot verify document in ${record.status} status`,
    }
  }

  const now = new Date().toISOString()
  record.status = input.status
  record.verifierId = input.verifierId
  record.verifiedAt = now
  record.verificationMetadata = input.verificationMetadata ?? null
  record.updatedAt = now

  // Lock document if approved
  if (input.status === TrustStatus.APPROVED) {
    record.activeForDecision = true
  }

  return { success: true, record, error: null }
}

/**
 * Revoke a document trust record.
 */
export function revokeDocument(
  documentId: string,
  revokedById: string,
  reason: string
): DocumentWriteResult {
  const record = documentStore.find((d) => d.id === documentId)
  if (!record) {
    return { success: false, record: null, error: "Document not found" }
  }

  if (record.status === TrustStatus.REVOKED) {
    return { success: false, record: null, error: "Document already revoked" }
  }

  const now = new Date().toISOString()
  record.status = TrustStatus.REVOKED
  record.revokedAt = now
  record.revokedById = revokedById
  record.revocationReason = reason
  record.activeForDecision = false
  record.updatedAt = now

  return { success: true, record, error: null }
}

/**
 * Get the active trust record for a specific document type and owner.
 * Returns the current active-for-decision version.
 */
export function getActiveDocumentTrust(
  ownerEntityId: string,
  ownerEntityType: OwnerEntityType,
  documentType: TrustDocumentType
): DocumentTrustRecord | null {
  return (
    documentStore.find(
      (d) =>
        d.ownerEntityId === ownerEntityId &&
        d.ownerEntityType === ownerEntityType &&
        d.documentType === documentType &&
        d.activeForDecision
    ) ?? null
  )
}

/**
 * Get the full version chain for a document type/owner.
 */
export function getDocumentVersionChain(
  ownerEntityId: string,
  ownerEntityType: OwnerEntityType,
  documentType: TrustDocumentType
): DocumentTrustRecord[] {
  return documentStore
    .filter(
      (d) =>
        d.ownerEntityId === ownerEntityId &&
        d.ownerEntityType === ownerEntityType &&
        d.documentType === documentType
    )
    .sort((a, b) => a.versionNumber - b.versionNumber)
}

/**
 * Check if a document hash has changed from the active version.
 * Used to detect document tampering after approval.
 */
export function hasDocumentHashChanged(
  ownerEntityId: string,
  ownerEntityType: OwnerEntityType,
  documentType: TrustDocumentType,
  currentHash: string
): boolean {
  const active = getActiveDocumentTrust(
    ownerEntityId,
    ownerEntityType,
    documentType
  )
  if (!active) return false
  return active.fileHash !== currentHash
}

/**
 * Get a document by ID.
 */
export function getDocumentById(
  documentId: string
): DocumentTrustRecord | null {
  return documentStore.find((d) => d.id === documentId) ?? null
}
