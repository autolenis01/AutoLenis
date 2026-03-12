"use client"

import type React from "react"

import { csrfHeaders } from "@/lib/csrf-client"
import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/layout/protected-route"
import { VehicleCard } from "@/components/buyer/vehicle-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { extractApiError } from "@/lib/utils/error-message"
import { useRouter } from "next/navigation"
import { ShoppingCart, AlertCircle, DollarSign, ArrowRight, Shield, Globe, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import NoLocalDealersNotice from "@/components/buyer/no-local-dealers-notice"

type TrustLabel = "Verified Available" | "Likely Available" | "Availability Unconfirmed"

function TrustBadge({ label }: { label: TrustLabel }) {
  switch (label) {
    case "Verified Available":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
          <Shield className="h-3 w-3" />
          Verified Available
        </Badge>
      )
    case "Likely Available":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Likely Available
        </Badge>
      )
    case "Availability Unconfirmed":
      return (
        <Badge variant="secondary" className="gap-1">
          <Globe className="h-3 w-3" />
          Availability Unconfirmed
        </Badge>
      )
  }
}

function SourceBadge({ source }: { source: string }) {
  if (source === "verified") {
    return <Badge variant="outline" className="text-xs text-green-700 border-green-300">Network Dealer</Badge>
  }
  return <Badge variant="outline" className="text-xs text-muted-foreground">Market</Badge>
}

export default function BuyerSearchPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [marketVehicles, setMarketVehicles] = useState<any[]>([])
  const [shortlist, setShortlist] = useState<any>(null)
  const [preQual, setPreQual] = useState<any>(null)
  const [approvalType, setApprovalType] = useState<string | undefined>()
  const [_filters, _setFilters] = useState({
    makes: [] as string[],
    bodyStyles: [] as string[],
    maxPrice: "",
    maxMileage: "",
  })
  const [availableFilters, setAvailableFilters] = useState<any>({
    makes: [],
    bodyStyles: [],
  })
  const [loading, setLoading] = useState(true)
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const [coverageGap, setCoverageGap] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch from both the existing inventory search and the dual-lane search
        const [vehiclesRes, dualLaneRes, shortlistRes, preQualRes, filtersRes] = await Promise.all([
          fetch("/api/inventory/search"),
          fetch("/api/buyer/inventory/search?source=all&budgetOnly=false").catch(() => null),
          fetch("/api/buyer/shortlist"),
          fetch("/api/buyer/prequal"),
          fetch("/api/inventory/filters"),
        ])

        const [vehiclesData, shortlistData, preQualData, filtersData] = await Promise.all([
          vehiclesRes.json(),
          shortlistRes.json(),
          preQualRes.json(),
          filtersRes.json(),
        ])

        // Parse dual-lane results
        let dualLaneData: any = null
        if (dualLaneRes) {
          try {
            dualLaneData = await dualLaneRes.json()
          } catch {
            // Dual-lane API may not be available in all environments
          }
        }

        // Use dual-lane results if available, otherwise fall back to standard search
        if (dualLaneData?.success && dualLaneData?.data?.items) {
          const allItems = dualLaneData.data.items
          const verified = allItems.filter((item: any) => item.sourceType === "verified")
          const market = allItems.filter((item: any) => item.sourceType === "market")
          setVehicles(verified.length > 0 ? verified : vehiclesData.success ? vehiclesData.data.items : [])
          setMarketVehicles(market)
          if (dualLaneData.approvalType) setApprovalType(dualLaneData.approvalType)
        } else if (vehiclesData.success) {
          setVehicles(vehiclesData.data.items)
        }

        if (shortlistData.success) setShortlist(shortlistData.data.shortlist)
        if (preQualData.success && preQualData.data?.preQualification) {
          const pq = preQualData.data.preQualification
          const isExpired = pq.expiresAt ? new Date(pq.expiresAt) < new Date() : false
          setPreQual({
            ...pq,
            maxOtd: pq.maxOtdAmountCents ? pq.maxOtdAmountCents / 100 : pq.maxOtd,
            isExpired,
          })
          // Server-side coverage gap detection: check only when pre-qualified and no vehicles
          const items = vehiclesData.success ? vehiclesData.data.items : []
          if (!isExpired && items.length === 0 && pq.zip) {
            try {
              const gapRes = await fetch(`/api/buyer/coverage-gap?marketZip=${encodeURIComponent(pq.zip)}`)
              const gapData = await gapRes.json()
              if (gapData.success && gapData.data?.isGap) {
                setCoverageGap(true)
              }
            } catch {
              // Non-critical: don't block search page if gap check fails
            }
          }
        }
        if (filtersData.success) setAvailableFilters(filtersData.data)
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load data",
        })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [toast])

  const handleAddToShortlist = async (inventoryItemId: string) => {
    try {
      const response = await fetch("/api/buyer/shortlist", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ inventoryItemId }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(extractApiError(data.error, "Search failed"))
      }

      setShortlist(data.data.shortlist)

      toast({
        title: "Added to shortlist",
        description: "Vehicle added successfully",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    }
  }

  const isInShortlist = (inventoryItemId: string) => {
    return shortlist?.items.some((item: any) => item.inventoryItemId === inventoryItemId)
  }

  const isInBudget = (price: number) => {
    if (!preQual || preQual.isExpired) return true // Show all if no prequal or expired
    return price <= (preQual.maxOtd || 0)
  }

  const filteredVehicles = vehicles.filter((item) => {
    // If prequal exists and is active, filter by budget
    if (preQual && !preQual.isExpired && preQual.maxOtd) {
      return item.price <= preQual.maxOtd
    }
    return true
  })

  const filteredMarketVehicles = marketVehicles.filter((item) => {
    if (preQual && !preQual.isExpired && preQual.maxOtd) {
      const price = item.priceCents ? item.priceCents / 100 : item.price || 0
      return price <= preQual.maxOtd
    }
    return true
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getTrustLabel = (item: any): TrustLabel => {
    if (item.trustLabel) return item.trustLabel
    if (item.sourceType === "verified") return "Verified Available"
    if (item.confidence != null && item.confidence >= 0.75) return "Likely Available"
    return "Availability Unconfirmed"
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["BUYER"]}>
        <div className="min-h-screen bg-muted/30">
          <div className="container py-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-96 mb-8" />
            <div className="grid lg:grid-cols-4 gap-6">
              <Skeleton className="h-64 lg:col-span-1" />
              <div className="lg:col-span-3 grid md:grid-cols-2 gap-6">
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["BUYER"]}>
      <div className="min-h-screen bg-muted/30">
        <div className="container py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Search vehicles</h1>
              {preQual && !preQual.isExpired ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span>
                    Showing vehicles up to{" "}
                    <span className="font-semibold text-foreground">{formatCurrency(preQual.maxOtd)}</span>
                  </span>
                  <Badge variant="secondary" className="ml-1">
                    {filteredVehicles.length + filteredMarketVehicles.length} available
                  </Badge>
                  {approvalType && (
                    <Badge variant="outline" className="ml-1 text-xs">
                      {approvalType === "autolenis" ? "AutoLenis Pre-Qual" : approvalType === "external" ? "External Approval" : "Cash Budget"}
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Get pre-qualified to see vehicles within your budget</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {(!preQual || preQual.isExpired) && (
                <Link href="/buyer/onboarding">
                  <Button variant="outline">
                    Get Pre-Qualified
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              )}

              {shortlist && shortlist.items.length > 0 && (
                <Button onClick={() => router.push("/buyer/shortlist")} size="lg">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  View Shortlist ({shortlist.items.length})
                </Button>
              )}
            </div>
          </div>

          {!preQual && (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4">
                <AlertCircle className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold">Get pre-qualified first</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete a quick soft credit check to see your budget and filter vehicles within your price range.
                    You can also <Link href="/buyer/prequal/external" className="text-primary underline">upload an outside approval</Link> if you already have one.
                  </p>
                </div>
                <Link href="/buyer/onboarding">
                  <Button>Start Now</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {preQual && preQual.isExpired && (
            <Card className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4">
                <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Pre-qualification expired</h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Your pre-qualification has expired. Refresh to see vehicles within your updated budget.
                  </p>
                </div>
                <Link href="/buyer/prequal">
                  <Button variant="outline">Refresh Pre-Qual</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <Card className="lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Make</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Filter by make"
                  >
                    <option value="">All makes</option>
                    {availableFilters.makes.map((make: string) => (
                      <option key={make} value={make}>
                        {make}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Body style</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Filter by body style"
                  >
                    <option value="">All styles</option>
                    {availableFilters.bodyStyles.map((style: string) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Max mileage</Label>
                  <Input type="number" placeholder="100000" aria-label="Maximum mileage" />
                </div>

                {preQual && !preQual.isExpired && (
                  <div className="pt-4 border-t">
                    <div className="text-sm font-medium mb-2">Your Budget</div>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(preQual.maxOtd)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Based on your pre-qualification</p>
                  </div>
                )}

                {/* Trust label legend */}
                <div className="pt-4 border-t space-y-2">
                  <p className="text-sm font-medium">Availability Labels</p>
                  <div className="space-y-1.5">
                    <TrustBadge label="Verified Available" />
                    <p className="text-xs text-muted-foreground ml-1">Confirmed by network dealer</p>
                    <TrustBadge label="Likely Available" />
                    <p className="text-xs text-muted-foreground ml-1">High confidence from market data</p>
                    <TrustBadge label="Availability Unconfirmed" />
                    <p className="text-xs text-muted-foreground ml-1">Sourced from public listing</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vehicle Grid */}
            <div className="lg:col-span-3">
              {/* Verified Inventory Section */}
              {filteredVehicles.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-green-600" />
                    <h2 className="text-lg font-semibold">Verified Inventory</h2>
                    <Badge variant="secondary">{filteredVehicles.length}</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    {filteredVehicles.map((item) => (
                      <div key={item.id} className="relative">
                        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                          <TrustBadge label={getTrustLabel(item)} />
                          <SourceBadge source="verified" />
                        </div>
                        <VehicleCard
                          vehicle={item.vehicle || item}
                          inventoryItem={item}
                          dealer={item.dealer || { businessName: item.dealerName, city: "", state: "" }}
                          onAddToShortlist={() => handleAddToShortlist(item.id)}
                          isInShortlist={isInShortlist(item.id)}
                          showInBudget={isInBudget(item.price)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Market Inventory Section */}
              {filteredMarketVehicles.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold">Market Inventory</h2>
                    <Badge variant="secondary">{filteredMarketVehicles.length}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Additional vehicles found from broader market sources. Availability may vary.
                  </p>
                  <div className="grid md:grid-cols-2 gap-6">
                    {filteredMarketVehicles.map((item) => {
                      const price = item.priceCents ? item.priceCents / 100 : item.price || 0
                      return (
                        <div key={item.id} className="relative">
                          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                            <TrustBadge label={getTrustLabel(item)} />
                            <SourceBadge source="market" />
                          </div>
                          <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="relative aspect-video bg-muted flex items-center justify-center">
                              {item.images?.[0] ? (
                                <img
                                  src={item.images[0]}
                                  alt={`${item.year} ${item.make} ${item.model}`}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <CarIcon className="h-16 w-16 text-muted-foreground/30" />
                              )}
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-semibold text-lg leading-tight mb-1">
                                {item.year} {item.make} {item.model}
                              </h3>
                              {item.trim && <p className="text-sm text-muted-foreground">{item.trim}</p>}
                              <div className="flex items-center gap-4 text-sm text-muted-foreground my-2">
                                {item.mileage && <span>{Number(item.mileage).toLocaleString()} mi</span>}
                                {item.bodyStyle && <><span>•</span><span>{item.bodyStyle}</span></>}
                              </div>
                              {item.dealerName && (
                                <p className="text-sm text-muted-foreground mb-2">{item.dealerName}{item.dealerZip ? ` — ${item.dealerZip}` : ""}</p>
                              )}
                              <div className="flex items-center justify-between mt-3">
                                <div>
                                  <div className="text-2xl font-bold">{price > 0 ? formatCurrency(price) : "Contact for price"}</div>
                                  <div className="text-xs text-muted-foreground">Market listing</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {filteredVehicles.length === 0 && filteredMarketVehicles.length === 0 && (
                <div className="col-span-2">
                  {coverageGap && !noticeDismissed ? (
                    <NoLocalDealersNotice onDismiss={() => setNoticeDismissed(true)} />
                  ) : (
                    <div className="text-center py-12">
                      <CarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">No vehicles found</h3>
                      <p className="text-muted-foreground mb-4">
                        {preQual && !preQual.isExpired
                          ? "No vehicles match your budget. Try adjusting your pre-qualification."
                          : "No vehicles found matching your criteria"}
                      </p>
                      {preQual && !preQual.isExpired && (
                        <Link href="/buyer/prequal">
                          <Button variant="outline">Update Pre-Qualification</Button>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function CarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  )
}
