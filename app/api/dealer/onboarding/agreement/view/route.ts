import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { dealerAgreementService } from "@/lib/services/dealer-agreement.service"
import { z } from "zod"
import { randomUUID } from "crypto"

const viewSchema = z.object({
  agreementId: z.string().min(1, "agreementId is required"),
  returnUrl: z.string().url("returnUrl must be a valid URL"),
})

/**
 * POST /api/dealer/onboarding/agreement/view
 *
 * Generate an embedded signing URL (DocuSign recipient view).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      )
    }

    const body = await req.json()
    const parsed = viewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors[0]?.message || "Invalid input",
          },
          correlationId: randomUUID(),
        },
        { status: 400 },
      )
    }

    const result = await dealerAgreementService.getSigningUrl(
      parsed.data.agreementId,
      parsed.data.returnUrl,
    )

    return NextResponse.json({
      success: true,
      url: result.url,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Failed to generate signing URL",
        },
        correlationId: randomUUID(),
      },
      { status: 500 },
    )
  }
}
