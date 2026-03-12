"use client"

import { ProtectedRoute } from "@/components/layout/protected-route"
import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/dashboard/empty-state"
import { LoadingSkeleton } from "@/components/dashboard/loading-skeleton"
import { ErrorState } from "@/components/dashboard/error-state"
import { StatusPill } from "@/components/dashboard/status-pill"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Gavel, Search, Building2, DollarSign, ArrowRight } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"
// import { useSearchParams } from "next/navigation"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function BuyerOffersPage() {
  // const _searchParams = useSearchParams()

  const { data, error, isLoading, mutate } = useSWR("/api/buyer/auctions", fetcher)

  // Flatten offers from all auctions
  const allOffers = (data?.data?.auctions || []).flatMap((auction: any) =>
    (auction.offers || []).map((offer: any) => ({
      ...offer,
      auction,
      vehicle: auction.shortlist?.items?.[0]?.inventoryItem?.vehicle,
    }))
  )

  return (
    <ProtectedRoute allowedRoles={["BUYER"]}>
      <div className="space-y-6">
        <PageHeader
          title="My Offers"
          subtitle="Review and compare offers from dealers"
        />

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search offers..." className="pl-9" />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSkeleton variant="cards" count={3} />
        ) : error ? (
          <ErrorState message="Failed to load offers" onRetry={() => mutate()} />
        ) : allOffers.length === 0 ? (
          <EmptyState
            icon={<Gavel className="h-8 w-8 text-muted-foreground" />}
            title="No offers yet"
            description="Complete your vehicle request to start receiving competitive offers from dealers."
            primaryCta={{ label: "Start a Request", href: "/buyer/search" }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allOffers.map((offer: any) => (
              <Card key={offer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {offer.vehicle?.year} {offer.vehicle?.make} {offer.vehicle?.model}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Building2 className="h-3 w-3" />
                          {offer.dealer?.name || "Dealer"}
                        </p>
                      </div>
                      <StatusPill status={offer.status?.toLowerCase() || "pending"} />
                    </div>

                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-[#7ED321]" />
                      <span className="text-2xl font-bold text-[#7ED321]">
                        {(offer.cashOtd || 0).toLocaleString()}
                      </span>
                    </div>

                    <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
                      <Link href={`/buyer/offers/${offer.id}`}>
                        View Details
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

