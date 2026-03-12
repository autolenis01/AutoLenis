// Cron route security middleware
// Validates requests are from Vercel Cron service

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Vercel Cron IP ranges (as of 2024)
const VERCEL_CRON_IPS = [
  "76.76.21.0/24", // Vercel Cron service
  "76.76.21.21", // Specific Vercel Cron IP
  "76.76.21.142", // Specific Vercel Cron IP
]

function isIpInRange(ip: string, range: string): boolean {
  if (!range.includes("/")) {
    return ip === range
  }

  const [rangeIp, prefixLength] = range.split("/")
  if (!rangeIp || !prefixLength) {
    return false
  }
  
  const mask = -1 << (32 - Number.parseInt(prefixLength))

  const ipNum = ipToNumber(ip)
  const rangeNum = ipToNumber(rangeIp)

  return (ipNum & mask) === (rangeNum & mask)
}

function ipToNumber(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number.parseInt(octet), 0)
}

export async function validateCronRequest(request: NextRequest): Promise<NextResponse | null> {
  // Check cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env['CRON_SECRET']

  if (!cronSecret) {
    console.error("[CronSecurity] CRON_SECRET not configured")
    return NextResponse.json({ error: "Service not configured" }, { status: 503 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[CronSecurity] Invalid cron secret")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify IP address in production environments
  if (process.env.NODE_ENV === "production") {
    const ip = (request as any).ip || request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")

    if (!ip) {
      console.warn("[CronSecurity] No IP address found in request")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const isValidIp = VERCEL_CRON_IPS.some((range) => isIpInRange(ip, range))

    if (!isValidIp) {
      console.warn("[CronSecurity] Request from unauthorized IP:", ip)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  return null
}
