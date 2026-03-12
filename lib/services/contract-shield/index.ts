// Contract Shield Service - Automated contract review assistant
// NOTE: This is an informational tool only. It does not provide legal, tax, or financial advice.

// Re-export all types and constants
export {
  DOCUMENT_TYPES,
  FLAGGED_ADD_ONS,
  STATE_DOC_FEE_REFERENCE,
  type DocumentType,
  type IssueSeverity,
  type ScanIssueItem,
  type ScanStatus,
} from "./types"

// Re-export public sub-module functions for direct use
// NOTE: checkMathConsistency, reviewFees, checkDocumentCompleteness, and
// sendOverrideNotification are intentionally NOT re-exported here — they were
// private in the original class and are only exported from their sub-modules
// for cross-module internal use (e.g., reconciliation → notifications).
export { scanContract, resolveFixItem } from "./scanner"
export { adminOverride, adminOverrideWithConsent, buyerAcknowledgeOverride } from "./overrides"
export { sendStatusChangeNotification } from "./notifications"
export { getActiveRules, updateRule, initializeDefaultRules } from "./rules"
export { runReconciliationJob } from "./reconciliation"
export {
  getOverridesLedger,
  getScanWithDetails,
  getScanByDealId,
  getDocumentsByDealId,
  uploadDocument,
  uploadContract,
} from "./queries"

// Import sub-module functions for class composition
import { scanContract, resolveFixItem } from "./scanner"
import { adminOverride, adminOverrideWithConsent, buyerAcknowledgeOverride } from "./overrides"
import { sendStatusChangeNotification } from "./notifications"
import { getActiveRules, updateRule, initializeDefaultRules } from "./rules"
import { runReconciliationJob } from "./reconciliation"
import {
  getOverridesLedger,
  getScanWithDetails,
  getScanByDealId,
  getDocumentsByDealId,
  uploadDocument,
  uploadContract,
} from "./queries"
import type { DocumentType } from "./types"

/**
 * ContractShieldService class composed from sub-modules.
 * Preserves the original static-method API for backward compatibility.
 */
export class ContractShieldService {
  static uploadDocument(
    selectedDealId: string,
    dealerId: string,
    fileUrl: string,
    documentType: DocumentType,
    metaJson?: Record<string, any>,
  ) {
    return uploadDocument(selectedDealId, dealerId, fileUrl, documentType, metaJson)
  }

  static scanContract(selectedDealId: string) {
    return scanContract(selectedDealId)
  }

  static resolveFixItem(
    fixItemId: string,
    resolution: {
      resolved: boolean
      explanation?: string
      newDocumentId?: string
    },
  ) {
    return resolveFixItem(fixItemId, resolution)
  }

  static adminOverride(scanId: string, action: "FORCE_PASS" | "FORCE_FAIL", adminId: string, reason: string) {
    return adminOverride(scanId, action, adminId, reason)
  }

  static adminOverrideWithConsent(
    scanId: string,
    action: "FORCE_PASS" | "FORCE_FAIL",
    adminId: string,
    reason: string,
  ) {
    return adminOverrideWithConsent(scanId, action, adminId, reason)
  }

  static buyerAcknowledgeOverride(overrideId: string, buyerId: string, comment?: string) {
    return buyerAcknowledgeOverride(overrideId, buyerId, comment)
  }

  static sendStatusChangeNotification(scanId: string, oldStatus: string, newStatus: string) {
    return sendStatusChangeNotification(scanId, oldStatus, newStatus)
  }

  static getActiveRules() {
    return getActiveRules()
  }

  static updateRule(
    ruleId: string,
    updates: {
      enabled?: boolean
      thresholdValue?: number
      severity?: string
      configJson?: Record<string, any>
    },
  ) {
    return updateRule(ruleId, updates)
  }

  static initializeDefaultRules() {
    return initializeDefaultRules()
  }

  static runReconciliationJob(jobType: "SYNC_STATUSES" | "CHECK_STALE_SCANS" | "NOTIFY_PENDING") {
    return runReconciliationJob(jobType)
  }

  static getOverridesLedger(filters?: {
    scanId?: string
    adminId?: string
    buyerAcknowledged?: boolean
    startDate?: Date
    endDate?: Date
  }) {
    return getOverridesLedger(filters)
  }

  static getScanWithDetails(scanId: string) {
    return getScanWithDetails(scanId)
  }

  static getScanByDealId(dealId: string) {
    return getScanByDealId(dealId)
  }

  static getDocumentsByDealId(dealId: string) {
    return getDocumentsByDealId(dealId)
  }

  static uploadContract(dealId: string, dealerId: string, documentUrl: string, documentType: string) {
    return uploadContract(dealId, dealerId, documentUrl, documentType)
  }
}

export const contractShieldService = new ContractShieldService()
