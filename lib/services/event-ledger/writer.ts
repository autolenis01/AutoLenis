/**
 * Event-Driven Workflow and Operational Ledger — Writer
 *
 * Canonical event writing utility with:
 * - Idempotency protection (deduplication via idempotencyKey)
 * - Structured event creation
 * - Event validation
 * - Timeline query utilities
 */

import type {
  PlatformEvent,
  EventWriteInput,
  TimelineQueryOptions,
  TimelineEntry,
  TimelineResult,
  PlatformEventType,
  EntityType,
  EventProcessingStatus,
} from "./types"
import {
  PlatformEventType as EventTypes,
  EntityType as EntityTypes,
  ActorType as ActorTypes,
  EventProcessingStatus as ProcessingStatuses,
} from "./types"

// ---------------------------------------------------------------------------
// In-Memory Event Store (replaced by Prisma/DB in production integration)
// ---------------------------------------------------------------------------

let eventStore: PlatformEvent[] = []

/**
 * Reset the event store. Only used in tests.
 */
export function resetEventStore(): void {
  eventStore = []
}

/**
 * Get all events in the store. Only used in tests and admin queries.
 */
export function getEventStore(): ReadonlyArray<PlatformEvent> {
  return eventStore
}

// ---------------------------------------------------------------------------
// Event ID Generation
// ---------------------------------------------------------------------------

let eventCounter = 0

function generateEventId(): string {
  eventCounter++
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `evt_${timestamp}_${random}_${eventCounter}`
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_EVENT_TYPES = new Set<string>(Object.values(EventTypes))
const VALID_ENTITY_TYPES = new Set<string>(Object.values(EntityTypes))
const VALID_ACTOR_TYPES = new Set<string>(Object.values(ActorTypes))

export function validateEventInput(input: EventWriteInput): string | null {
  if (!input.eventType || !VALID_EVENT_TYPES.has(input.eventType)) {
    return `Invalid eventType: ${input.eventType}`
  }
  if (!input.entityType || !VALID_ENTITY_TYPES.has(input.entityType)) {
    return `Invalid entityType: ${input.entityType}`
  }
  if (!input.actorType || !VALID_ACTOR_TYPES.has(input.actorType)) {
    return `Invalid actorType: ${input.actorType}`
  }
  if (!input.entityId || typeof input.entityId !== "string") {
    return "entityId is required"
  }
  if (!input.actorId || typeof input.actorId !== "string") {
    return "actorId is required"
  }
  if (!input.sourceModule || typeof input.sourceModule !== "string") {
    return "sourceModule is required"
  }
  if (!input.correlationId || typeof input.correlationId !== "string") {
    return "correlationId is required"
  }
  return null
}

// ---------------------------------------------------------------------------
// Event Writer
// ---------------------------------------------------------------------------

export interface WriteEventResult {
  success: boolean
  event: PlatformEvent | null
  duplicate: boolean
  error: string | null
}

/**
 * Write a canonical platform event with idempotency protection.
 *
 * If an idempotencyKey is provided and an event with the same key already
 * exists, the write is skipped and the existing event is returned with
 * `duplicate: true`.
 */
export function writeEvent(input: EventWriteInput): WriteEventResult {
  // Validate input
  const validationError = validateEventInput(input)
  if (validationError) {
    return { success: false, event: null, duplicate: false, error: validationError }
  }

  // Idempotency check
  if (input.idempotencyKey) {
    const existing = eventStore.find(
      (e) => e.idempotencyKey === input.idempotencyKey
    )
    if (existing) {
      return { success: true, event: existing, duplicate: true, error: null }
    }
  }

  const event: PlatformEvent = {
    id: generateEventId(),
    eventType: input.eventType,
    eventVersion: 1,
    entityType: input.entityType,
    entityId: input.entityId,
    parentEntityId: input.parentEntityId ?? null,
    workspaceId: input.workspaceId ?? null,
    actorId: input.actorId,
    actorType: input.actorType,
    sourceModule: input.sourceModule,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey ?? null,
    payload: input.payload ?? {},
    processingStatus: ProcessingStatuses.RECORDED,
    createdAt: new Date().toISOString(),
  }

  eventStore.push(event)

  return { success: true, event, duplicate: false, error: null }
}

// ---------------------------------------------------------------------------
// Event Summary Generator
// ---------------------------------------------------------------------------

const EVENT_SUMMARY_MAP: Partial<Record<PlatformEventType, string>> = {
  BUYER_ACCOUNT_CREATED: "Buyer account created",
  BUYER_PROFILE_COMPLETED: "Buyer profile completed",
  BUYER_PREQUALIFIED: "Buyer pre-qualified",
  EXTERNAL_PREAPPROVAL_SUBMITTED: "External pre-approval submitted",
  EXTERNAL_PREAPPROVAL_APPROVED: "External pre-approval approved",
  EXTERNAL_PREAPPROVAL_REJECTED: "External pre-approval rejected",
  EXTERNAL_PREAPPROVAL_EXPIRED: "External pre-approval expired",
  EXTERNAL_PREAPPROVAL_SUPERSEDED: "External pre-approval superseded",
  BUYER_REQUEST_CREATED: "Vehicle request created",
  AUCTION_CREATED: "Auction created",
  DEALER_INVITED: "Dealer invited to auction",
  OFFER_SUBMITTED: "Offer submitted",
  OFFER_SELECTED: "Offer selected",
  FINANCING_CHOSEN: "Financing option chosen",
  FEE_PAID: "Concierge fee paid",
  INSURANCE_COMPLETED: "Insurance completed",
  CONTRACT_UPLOADED: "Contract uploaded",
  CONTRACT_SCAN_COMPLETED: "Contract scan completed",
  CONTRACT_FAILED: "Contract scan failed",
  CONTRACT_REVIEW_READY: "Contract ready for review",
  CONTRACT_PASSED: "Contract passed",
  CMA_OPENED: "Manual review opened",
  CMA_APPROVED: "Manual review approved",
  CMA_RETURNED_INTERNAL_FIX: "Manual review returned for internal fix",
  CMA_REVOKED: "Manual review revoked",
  ESIGN_SENT: "E-sign envelope sent",
  ESIGN_COMPLETED: "E-sign completed",
  PICKUP_SCHEDULED: "Pickup scheduled",
  REFUND_REQUESTED: "Refund requested",
  REFUND_APPROVED: "Refund approved",
  REFUND_DENIED: "Refund denied",
  PAYOUT_HELD: "Payout held",
  PAYOUT_RELEASED: "Payout released",
  AFFILIATE_COMMISSION_CREATED: "Commission created",
  AFFILIATE_COMMISSION_HELD: "Commission held",
  AFFILIATE_COMMISSION_RELEASED: "Commission released",
  DEAL_STATUS_CHANGED: "Deal status changed",
  DEAL_CANCELLED: "Deal cancelled",
  DEAL_COMPLETED: "Deal completed",
}

function generateEventSummary(event: PlatformEvent): string {
  return EVENT_SUMMARY_MAP[event.eventType] ?? event.eventType
}

// ---------------------------------------------------------------------------
// Timeline Query
// ---------------------------------------------------------------------------

/**
 * Query the event ledger to reconstruct a canonical timeline.
 */
export function queryTimeline(options: TimelineQueryOptions): TimelineResult {
  let filtered = [...eventStore]

  if (options.entityType) {
    filtered = filtered.filter((e) => e.entityType === options.entityType)
  }
  if (options.entityId) {
    filtered = filtered.filter((e) => e.entityId === options.entityId)
  }
  if (options.eventTypes && options.eventTypes.length > 0) {
    const typeSet = new Set<string>(options.eventTypes)
    filtered = filtered.filter((e) => typeSet.has(e.eventType))
  }
  if (options.actorId) {
    filtered = filtered.filter((e) => e.actorId === options.actorId)
  }
  if (options.correlationId) {
    filtered = filtered.filter((e) => e.correlationId === options.correlationId)
  }
  if (options.since) {
    const sinceDate = new Date(options.since)
    filtered = filtered.filter((e) => new Date(e.createdAt) >= sinceDate)
  }
  if (options.until) {
    const untilDate = new Date(options.until)
    filtered = filtered.filter((e) => new Date(e.createdAt) <= untilDate)
  }

  // Sort by createdAt ascending
  filtered.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const total = filtered.length
  const offset = options.offset ?? 0
  const limit = options.limit ?? 50
  const paged = filtered.slice(offset, offset + limit)

  const entries: TimelineEntry[] = paged.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    actorId: event.actorId,
    actorType: event.actorType,
    sourceModule: event.sourceModule,
    correlationId: event.correlationId,
    summary: generateEventSummary(event),
    payload: event.payload,
    createdAt: event.createdAt,
  }))

  return {
    entries,
    total,
    hasMore: offset + limit < total,
  }
}

// ---------------------------------------------------------------------------
// Entity Timeline Shortcut
// ---------------------------------------------------------------------------

/**
 * Get the complete timeline for a specific entity.
 */
export function getEntityTimeline(
  entityType: EntityType,
  entityId: string,
  limit?: number
): TimelineResult {
  return queryTimeline({ entityType, entityId, limit: limit ?? 100 })
}

/**
 * Get events by correlation ID (for tracing related actions).
 */
export function getCorrelatedEvents(correlationId: string): TimelineResult {
  return queryTimeline({ correlationId, limit: 200 })
}
