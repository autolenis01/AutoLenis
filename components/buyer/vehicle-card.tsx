"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, MapPin } from "lucide-react"
import Image from "next/image"

interface VehicleCardProps {
  vehicle: any
  inventoryItem: any
  dealer: any
  onAddToShortlist?: () => void
  isInShortlist?: boolean
  showInBudget?: boolean
}

export function VehicleCard({
  vehicle,
  inventoryItem,
  dealer,
  onAddToShortlist,
  isInShortlist,
  showInBudget,
}: VehicleCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatMileage = (miles: number) => {
    return new Intl.NumberFormat("en-US").format(miles) + " mi"
  }

  const vehicleDescription = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative aspect-video bg-muted">
        <Image
          src={
            vehicle.images?.[0] ||
            "/placeholder.jpg"
          }
          alt={vehicleDescription}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={false}
        />
        {showInBudget && <Badge className="absolute top-3 right-3 bg-accent text-accent-foreground">In Budget</Badge>}
      </div>
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-lg leading-tight mb-1">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>
          {vehicle.trim && <p className="text-sm text-muted-foreground">{vehicle.trim}</p>}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <span>{formatMileage(vehicle.mileage)}</span>
          <span>•</span>
          <span>{vehicle.bodyStyle}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <MapPin className="h-4 w-4" />
          <span>
            {dealer.businessName} - {dealer.city}, {dealer.state}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{formatCurrency(inventoryItem.price)}</div>
            <div className="text-xs text-muted-foreground">Est. OTD price</div>
          </div>

          {onAddToShortlist && (
            <Button
              variant={isInShortlist ? "secondary" : "default"}
              size="sm"
              onClick={onAddToShortlist}
              disabled={isInShortlist}
            >
              <Heart className={`h-4 w-4 mr-2 ${isInShortlist ? "fill-current" : ""}`} />
              {isInShortlist ? "Added" : "Add"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
