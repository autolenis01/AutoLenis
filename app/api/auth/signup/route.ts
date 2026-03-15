import { NextResponse } from "next/server"
import { AuthService } from "@/lib/services/auth.service"
import { signUpSchema } from "@/lib/validators/auth"
import { setSessionCookie } from "@/lib/auth-server"
import { getRoleBasedRedirect } from "@/lib/auth"
import { rateLimit, rateLimits } from "@/lib/middleware/rate-limit"
import { handleError, ConflictError } from "@/lib/middleware/error-handler"
import { logger } from "@/lib/logger"
import { onUserCreated } from "@/lib/email/triggers"
import { emailVerificationService } from "@/lib/services/email-verification.service"

export async function OPTIONS() {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://autolenis.com'
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": appUrl,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

export async function POST(request: Request) {
  logger.info("SignUp request received")

  if (!process.env['NEXT_PUBLIC_SUPABASE_URL'] || !process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    logger.error("Missing required environment variables for signup")
    return NextResponse.json(
      {
        success: false,
        error: "Server configuration error. Please contact support.",
      },
      { status: 503 },
    )
  }

  try {
    const rateLimitResponse = await rateLimit(request as any, rateLimits.auth)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      logger.error("Failed to parse signup request body", { error: parseError })
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request format",
        },
        { status: 400 },
      )
    }

    logger.debug("Parsing signup request", { email: body.email })

    const validated = signUpSchema.parse(body)
    logger.debug("Signup input validated, calling AuthService")

    const result = await AuthService.signUp(validated)
    logger.info("Sign up successful", { userId: result.user.id, email: result.user.email })

    const { user, token } = result

    await setSessionCookie(token)
    logger.debug("Session cookie set for signup")

    // Fire email triggers asynchronously (best-effort, do not block response)
    onUserCreated({
      userId: user.id,
      email: user.email,
      firstName: user.firstName || validated.firstName,
      role: user.role,
      referral: result.referral ? { code: result.referral.referralCode } : undefined,
      packageTier: user.packageTier,
    }).catch((err) => {
      logger.error("onUserCreated trigger failed", err as Error)
    })

    // Send verification email (fire-and-forget — never block signup response)
    emailVerificationService.createVerificationToken(user.id, user.email).catch((err) => {
      logger.error("Verification email send failed after signup", err as Error)
    })

    const redirect = getRoleBasedRedirect(user.role, true)
    logger.debug("Redirecting after signup", { redirect, role: user.role })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        redirect,
      },
    })
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      return handleError(new ConflictError("An account with this email already exists"))
    }
    return handleError(error)
  }
}
