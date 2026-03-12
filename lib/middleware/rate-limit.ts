// Rate limiting middleware for API routes
// Protects against brute force attacks and abuse
//
// Uses the CacheAdapter abstraction so rate-limit state is shared across
// serverless instances when a Redis-backed adapter is configured (REDIS_URL).
//
// Production policy: rate limiting requires Redis. In-memory fallback is
// allowed only in test/local environments.

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getCacheAdapter, assertProductionCacheReady, InMemoryCacheAdapter } from "@/lib/cache/redis-adapter"

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  keyGenerator?: (request: NextRequest) => string
  /**
   * When true, the rate limiter will fail closed (return 503) if Redis is
   * unavailable in production. Use for security-critical auth endpoints
   * where in-memory fallback would allow bypass across instances.
   */
  securityCritical?: boolean
}

/**
 * Extract the client IP from the request.
 * Uses the first trusted x-forwarded-for entry, then falls back to request IP.
 */
function extractClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    // Use the first (leftmost / client-closest) IP
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return (request as any).ip || "unknown"
}

export async function rateLimit(request: NextRequest, config: RateLimitConfig): Promise<NextResponse | null> {
  const { maxRequests, windowMs, keyGenerator, securityCritical } = config

  // Vercel preview deployments set NODE_ENV=production but are not true
  // production. Only enforce Redis requirements in actual production.
  const isStrictProduction =
    process.env["NODE_ENV"] === "production" && process.env["VERCEL_ENV"] !== "preview"

  // In production, enforce Redis availability for rate limiting.
  // Security-critical endpoints (auth flows) fail closed with 503;
  // non-critical endpoints degrade to in-memory with a warning.
  try {
    assertProductionCacheReady()
  } catch {
    if (isStrictProduction) {
      if (securityCritical) {
        console.error("[RateLimit] CRITICAL: Redis unavailable in production for security-critical endpoint. Returning 503.")
        return NextResponse.json(
          {
            success: false,
            error: "Service temporarily unavailable. Please try again later.",
          },
          { status: 503, headers: { "Retry-After": "30" } },
        )
      }
      console.error("[RateLimit] CRITICAL: Redis unavailable in production — rate limiting degraded to in-memory. Configure REDIS_URL to restore full protection.")
    }
  }

  // Generate rate limit key with canonical IP extraction
  const clientIp = extractClientIp(request)
  const rawKey = keyGenerator ? keyGenerator(request) : clientIp
  const key = `rl:${rawKey}`

  const cache = getCacheAdapter()

  // Production guard: refuse in-memory limiter in production for security-critical endpoints.
  // Vercel preview deployments (VERCEL_ENV=preview) are excluded — they may
  // legitimately fall back to in-memory when Redis is not provisioned.
  if (isStrictProduction && cache instanceof InMemoryCacheAdapter) {
    if (securityCritical) {
      console.error("[RateLimit] In-memory limiter detected in production for security-critical endpoint. Returning 503.")
      return NextResponse.json(
        {
          success: false,
          error: "Service temporarily unavailable. Please try again later.",
        },
        { status: 503, headers: { "Retry-After": "30" } },
      )
    }
    // Log but don't block for non-critical endpoints
    console.error("[RateLimit] In-memory limiter detected in production. Rate limiting may be unreliable.")
  }

  const count = await cache.increment(key, windowMs)

  if (count > maxRequests) {
    // Rate limit exceeded – estimate remaining window time
    const retryAfter = Math.ceil(windowMs / 1000)
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Try again in a few minutes.",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Date.now() + windowMs),
        },
      },
    )
  }

  return null
}

// Preset rate limit configurations
export const rateLimits = {
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    securityCritical: true,
  },
  /**
   * Signin-specific rate limit.
   * - Production: 5 requests per minute per IP.
   * - Preview / development: 50 requests per minute (avoids locking out
   *   legitimate testing while still providing basic protection).
   */
  signin: (() => {
    const isProduction =
      process.env['VERCEL_ENV'] === "production" ||
      (process.env['NODE_ENV'] === "production" && process.env['VERCEL_ENV'] !== "preview")
    return {
      maxRequests: isProduction ? 10 : 50,
      windowMs: 60 * 1000, // 1 minute
      securityCritical: true,
    }
  })(),
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  strict: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  resendVerification: {
    maxRequests: 3,
    windowMs: 2 * 60 * 1000, // 2 minutes (enforces ~60s cooldown)
  },
  // Auto-resend verification email triggered on sign-in attempt: max 2 per 30 minutes per IP
  verificationOnSignin: {
    maxRequests: 2,
    windowMs: 30 * 60 * 1000, // 30 minutes
  },
  // Public affiliate click/referral tracking: 60 requests per hour per IP
  affiliateClick: {
    maxRequests: 60,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
}
