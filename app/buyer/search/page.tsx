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
import { ShoppingCart, AlertCircle, DollarSign, ArrowRight } from "lucide-react"
import Link from "next/link"
import NoLocalDealersNotice from "@/components/buyer/no-local-dealers-notice"

export default function BuyerSearchPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [shortlist, setShortlist] = useState<any>(null)
  const [preQual, setPreQual] = useState<any>(null)
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
        const [vehiclesRes, shortlistRes, preQualRes, filtersRes] = await Promise.all([
          fetch("/api/inventory/search"),
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

      if (vehiclesData.success) setVehicles(vehiclesData.data.items)
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount)
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
                    {filteredVehicles.length} available
                  </Badge>
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
              </CardContent>
            </Card>

            {/* Vehicle Grid */}
            <div className="lg:col-span-3">
              <div className="grid md:grid-cols-2 gap-6">
                {filteredVehicles.map((item) => (
                  <VehicleCard
                    key={item.id}
                    vehicle={item.vehicle}
                    inventoryItem={item}
                    dealer={item.dealer}
                    onAddToShortlist={() => handleAddToShortlist(item.id)}
                    isInShortlist={isInShortlist(item.id)}
                    showInBudget={isInBudget(item.price)}
                  />
                ))}

                {filteredVehicles.length === 0 && (
                  <div className="col-span-2">
                    {coverageGap && !noticeDismissed ? (
                      <NoLocalDealersNotice onDismiss={() => setNoticeDismissed(true)} />
                    ) : (
                      <div className="text-center py-12">
                        <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
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
      </div>
    </ProtectedRoute>
  )
}

function Car(props: React.SVGProps<SVGSVGElement>) {
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
