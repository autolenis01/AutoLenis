"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { ProtectedRoute } from "@/components/layout/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { extractApiError } from "@/lib/utils/error-message"
import { useRouter } from "next/navigation"
import { csrfHeaders } from "@/lib/csrf-client"
import { DollarSign, TrendingDown, Scale, X, Car, MapPin, Star, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function AuctionOffersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [bestPriceOptions, setBestPriceOptions] = useState<any[]>([])
  const [auction, setAuction] = useState<any>(null)
  const [decliningOffer, setDecliningOffer] = useState<string | null>(null)
  const [selectingOffer, setSelectingOffer] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get auction details
        const auctionRes = await fetch(`/api/auction/${id}`)
        const auctionData = await auctionRes.json()

        if (auctionData.success) {
          setAuction(auctionData.data.auction)

          // Compute best price options
          setComputing(true)
          await fetch(`/api/auction/${id}/best-price`, { method: "POST", headers: csrfHeaders() })

          // Get the computed options
          const optionsRes = await fetch(`/api/auction/${id}/best-price`)
          const optionsData = await optionsRes.json()

          if (optionsData.success) {
            setBestPriceOptions(optionsData.data.options)
          }
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load offers",
        })
      } finally {
        setLoading(false)
        setComputing(false)
      }
    }
    loadData()
  }, [id, toast])

  const handleDeclineOffer = async (offerId: string) => {
    try {
      const response = await fetch("/api/buyer/auction/decline", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ auctionId: id, offerId }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(extractApiError(data.error, "Failed to load offers"))
      }

      setBestPriceOptions(data.data.options)

      toast({
        title: "Offer declined",
        description: data.data.message,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    } finally {
      setDecliningOffer(null)
    }
  }

  const handleSelectOffer = async (offerId: string, financingOptionId?: string) => {
    setSelectingOffer(offerId)
    try {
      const response = await fetch("/api/buyer/deal/select", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          auctionId: id,
          offerId,
          financingOptionId,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(extractApiError(data.error, "Offer operation failed"))
      }

      toast({
        title: "Deal selected!",
        description: "Proceeding to financing and next steps",
      })

      router.push(`/buyer/deal`)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    } finally {
      setSelectingOffer(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getTypeInfo = (type: string) => {
    const types: Record<string, { label: string; icon: any; color: string; bgColor: string; description: string }> = {
      BEST_CASH: {
        label: "Best Cash Price",
        icon: DollarSign,
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200",
        description: "Lowest out-the-door price if paying cash or with your own financing",
      },
      BEST_MONTHLY: {
        label: "Best Monthly Payment",
        icon: TrendingDown,
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        description: "Lowest monthly payment with dealer financing options",
      },
      BALANCED: {
        label: "Best Overall Value",
        icon: Scale,
        color: "text-purple-600",
        bgColor: "bg-purple-50 border-purple-200",
        description: "Best combination of price, dealer reputation, and terms",
      },
    }
    return types[type] || types['BALANCED']
  }

  if (loading || computing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <div className="text-center">
          <div className="font-semibold mb-1">{computing ? "Analyzing offers..." : "Loading..."}</div>
          <div className="text-sm text-muted-foreground">
            {computing && "Our Best Price Engine is finding your top options"}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["BUYER"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Best Price Options</h1>
          <p className="text-muted-foreground">
            {auction?.offers?.length || 0} dealer{auction?.offers?.length !== 1 ? "s" : ""} submitted offers. Here are
            your top choices.
          </p>
        </div>

        {bestPriceOptions.length === 0 ? (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900">
                <AlertCircle className="h-5 w-5" />
                No More Offers Available
              </CardTitle>
              <CardDescription className="text-yellow-700">
                You've reviewed all available offers for this auction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-yellow-800">Your $99 deposit will be automatically refunded. You can:</p>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => router.push("/buyer/search")}>
                  Search Other Vehicles
                </Button>
                <Button onClick={() => router.push("/buyer/shortlist")}>Start New Auction</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {bestPriceOptions.map((option, index) => {
              const typeInfo = getTypeInfo(option.type)
              const Icon = typeInfo?.icon
              const vehicle = option.inventoryItem?.vehicle
              const dealer = option.dealer || option.inventoryItem?.dealer

              return (
                <Card key={option.id} className={`overflow-hidden border-2 ${typeInfo?.bgColor}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl bg-white shadow-sm`}>
                          {Icon && <Icon className={`h-6 w-6 ${typeInfo?.color}`} />}
                        </div>
                        <div>
                          <CardTitle className="text-xl flex items-center gap-2">
                            {typeInfo?.label}
                            {index === 0 && <Badge className="bg-[#7ED321] text-white">Recommended</Badge>}
                          </CardTitle>
                          <CardDescription>{typeInfo?.description}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        Score: {Math.round(option.score)}/100
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Vehicle Info */}
                    <div className="flex items-start gap-4 p-4 bg-white rounded-lg">
                      <div className="h-24 w-36 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                        <Car className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {vehicle?.year} {vehicle?.make} {vehicle?.model}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {vehicle?.trim} • {vehicle?.mileage?.toLocaleString()} miles
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {dealer?.city}, {dealer?.state}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            {dealer?.integrityScore || 85}/100
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-lg text-center">
                        <div className="text-sm text-muted-foreground mb-1">Cash OTD Price</div>
                        <div className="text-2xl font-bold text-primary">{formatCurrency(option.cashOtd)}</div>
                      </div>
                      {option.monthlyPayment && (
                        <div className="bg-white p-4 rounded-lg text-center">
                          <div className="text-sm text-muted-foreground mb-1">Monthly Payment</div>
                          <div className="text-2xl font-bold text-[#0066FF]">
                            {formatCurrency(option.monthlyPayment)}/mo
                          </div>
                        </div>
                      )}
                      <div className="bg-white p-4 rounded-lg text-center">
                        <div className="text-sm text-muted-foreground mb-1">Dealer</div>
                        <div className="font-semibold truncate">{dealer?.businessName}</div>
                      </div>
                    </div>

                    {/* Financing Options */}
                    {option.offer?.financingOptions?.length > 0 && (
                      <div className="bg-white p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Available Financing</h4>
                        <div className="flex gap-2 flex-wrap">
                          {option.offer.financingOptions.map((fin: any, i: number) => (
                            <Badge key={i} variant="outline" className="py-1.5">
                              {fin.apr}% APR • {fin.termMonths}mo • {formatCurrency(fin.monthlyPayment)}/mo
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleSelectOffer(option.offerId, option.financingOptionId)}
                        disabled={selectingOffer === option.offerId}
                        className="flex-1 bg-gradient-to-r from-[#7ED321] to-[#00D9FF] hover:opacity-90"
                        size="lg"
                      >
                        {selectingOffer === option.offerId ? (
                          "Processing..."
                        ) : (
                          <>
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            Select This Deal
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setDecliningOffer(option.offerId)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Decline Confirmation Dialog */}
        <AlertDialog open={!!decliningOffer} onOpenChange={() => setDecliningOffer(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Decline this offer?</AlertDialogTitle>
              <AlertDialogDescription>
                This offer will be removed from your options. If there are more offers available, the next best one will
                be shown in its place.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => decliningOffer && handleDeclineOffer(decliningOffer)}
                className="bg-red-600 hover:bg-red-700"
              >
                Decline Offer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  )
}
