import { prisma } from "@/lib/db"

export async function logEvent(dealId: string, eventType: string, details: Record<string, any>) {
  try {
    await prisma.complianceEvent.create({
      data: {
        dealId,
        eventType,
        details: details as any,
      },
    })
  } catch (error) {
    console.error("Failed to log event:", error)
  }
}
