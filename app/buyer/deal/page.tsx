"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { ProtectedRoute } from "@/components/layout/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Car, DollarSign, FileText, ArrowRight, Building2 } from "lucide-react"

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> =
  {
    SELECTED: { label: "Offer Selected", variant: "default" },
    FINANCING_PENDING: { label: "Financing Pending", variant: "secondary" },
    FINANCING_APPROVED: { label: "Financing Approved", variant: "default" },
    FEE_PENDING: { label: "Fee Pending", variant: "secondary" },
    FEE_PAID: { label: "Fee Paid", variant: "default" },
    INSURANCE_PENDING: { label: "Insurance Needed", variant: "secondary" },
    INSURANCE_COMPLETE: { label: "Insurance Verified", variant: "default" },
    CONTRACT_PENDING: { label: "Contract Pending", variant: "secondary" },
    CONTRACT_REVIEW: { label: "Under Review", variant: "secondary" },
    CONTRACT_APPROVED: { label: "Contract Ready", variant: "default" },
    SIGNING_PENDING: { label: "Awaiting Signature", variant: "secondary" },
    SIGNED: { label: "Signed", variant: "default" },
    PICKUP_SCHEDULED: { label: "Pickup Scheduled", variant: "default" },
    COMPLETE: { label: "Complete", variant: "default" },
  }

export default function BuyerDealPage() {
  const [deal, setDeal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  const loadDeal = useCallback(async () => {
    try {
      const response = await fetch("/api/buyer/deal")
      const data = await response.json()

      if (data.success) {
        setDeal(data.data.deal)
      } else {
        toast({
          title: "No active deal",
          description: "You need to select an offer from an auction first",
        })
        router.push("/buyer/dashboard")
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load deal information",
      })
    } finally {
      setLoading(false)
    }
  }, [router, toast])

  useEffect(() => {
    loadDeal()
  }, [loadDeal])

  const nextStep = useMemo(() => {
    if (!deal) return { href: "/buyer/dashboard", label: "Return to Dashboard" }

    const status = String(deal.status || "").toUpperCase()
    const hasFinancingChoice = !!deal.financingType || !!deal.paymentType

    const needsFinancingOrFee = new Set(["SELECTED", "FINANCING_APPROVED", "FEE_PENDING", "FINANCING_PENDING"])
    const needsInsurance = new Set(["FEE_PAID", "INSURANCE_PENDING"])
    const needsContract = new Set(["INSURANCE_COMPLETE", "CONTRACT_PENDING", "CONTRACT_REVIEW"])
    const needsESign = new Set(["CONTRACT_APPROVED", "SIGNING_PENDING"])
    const needsPickup = new Set(["SIGNED", "PICKUP_SCHEDULED"])

    if (needsFinancingOrFee.has(status)) {
      return hasFinancingChoice
        ? { href: "/buyer/deal/fee", label: "Continue to Concierge Fee" }
        : { href: "/buyer/deal/financing", label: "Select Financing" }
    }
    if (needsInsurance.has(status)) return { href: "/buyer/deal/insurance", label: "Continue to Insurance" }
    if (needsContract.has(status)) return { href: "/buyer/deal/contract", label: "Continue to Contract Shield" }
    if (needsESign.has(status)) return { href: "/buyer/deal/esign", label: "Continue to E-Sign" }
    if (needsPickup.has(status)) return { href: "/buyer/deal/pickup", label: "Continue to Pickup & QR" }

    return { href: "/buyer/deal", label: "View Deal" }
  }, [deal])

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["BUYER"]}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-8 w-36 rounded-full" />
          </div>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </ProtectedRoute>
    )
  }

  if (!deal) {
    return (
      <ProtectedRoute allowedRoles={["BUYER"]}>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-5">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Active Deal</h2>
          <p className="text-muted-foreground text-sm mb-6">Select an offer from an auction to get started.</p>
          <Button onClick={() => router.push("/buyer/dashboard")} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </ProtectedRoute>
    )
  }

  const auctionVehicle = deal.auctionOffer?.auction?.shortlist?.items?.[0]?.inventoryItem?.vehicle
  const auctionDealer = deal.auctionOffer?.dealer
  const sourcedCtx = deal.sourcedDealContext

  const vehicle = auctionVehicle ?? sourcedCtx?.vehicle ?? null
  const dealer = auctionDealer ?? (sourcedCtx ? { businessName: sourcedCtx.dealerName } : null)

  const taxesAndFees = deal.auctionOffer?.taxAmount ?? null
  const otd = deal.cashOtd ?? deal.otdPrice ?? null

  const statusKey = String(deal.status || "").toUpperCase()
  const statusInfo = STATUS_LABELS[statusKey] || { label: deal.status, variant: "secondary" as const }

  return (
    <ProtectedRoute allowedRoles={["BUYER"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Deal</h1>
          <Badge variant={statusInfo.variant} className="text-sm px-3 py-1 font-medium">
            {statusInfo.label}
          </Badge>
        </div>

        {/* Vehicle & Dealer */}
        <Card className="overflow-hidden border-0 shadow-md">
          <CardHeader className="bg-gradient-to-br from-[#0f172a] to-[#1e3a5f] text-white pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-5 w-5" />
              Selected Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-4">
                  {vehicle?.year} {vehicle?.make} {vehicle?.model}
                </h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Trim", value: vehicle?.trim },
                    { label: "Mileage", value: vehicle?.mileage ? `${vehicle.mileage.toLocaleString()} mi` : null },
                    { label: "Color", value: vehicle?.color || "Not specified" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VIN</span>
                    <span className="font-mono text-xs tracking-wide text-muted-foreground">{vehicle?.vin}</span>
                  </div>
                </div>
              </div>
              <div className="md:border-l md:pl-6">
                <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  Dealer
                </h4>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{dealer?.businessName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium">
                      {dealer?.city}, {dealer?.state}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Price Breakdown */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              Price Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Vehicle Price</span>
                <span className="text-lg font-semibold tabular-nums">
                  {otd ? `$${Number(otd).toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Taxes &amp; Fees</span>
                <span className="text-sm font-medium tabular-nums">
                  {typeof taxesAndFees === "number" ? `$${taxesAndFees.toLocaleString()}` : "TBD"}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between items-baseline">
                <span className="font-semibold">Total Out-the-Door</span>
                <span className="text-xl font-bold tabular-nums text-[#0066FF]">
                  {otd ? `$${Number(otd).toLocaleString()}` : "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Step CTA */}
        <Card className="bg-gradient-to-r from-[#0066FF]/5 to-[#00D9FF]/5 border-[#0066FF]/15 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-[#0066FF]" />
              Next Step
            </CardTitle>
            <CardDescription>Continue your deal through the secure AutoLenis flow.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push(nextStep.href)}
              className="w-full bg-[#0066FF] hover:bg-[#0066FF]/90 shadow-sm"
              size="lg"
            >
              {nextStep.label}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
