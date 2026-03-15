"use client"

import { VehicleCard as CanonicalVehicleCard, type ChipVariant } from "@/components/vehicles"

interface VehicleCardProps {
  vehicle: any
  inventoryItem: any
  dealer: any
  onAddToShortlist?: () => void
  isInShortlist?: boolean
  showInBudget?: boolean
}

/**
 * Legacy adapter — maps the old { vehicle, inventoryItem, dealer } shape
 * to the canonical VehicleCard props so existing consumers continue to work.
 */
export function VehicleCard({
  vehicle,
  inventoryItem,
  dealer,
  onAddToShortlist,
  isInShortlist,
  showInBudget,
}: VehicleCardProps) {
  const chips: ChipVariant[] = []
  if (showInBudget) chips.push("in-budget")

  const dealerLocation = [dealer?.city, dealer?.state].filter(Boolean).join(", ")

  return (
    <CanonicalVehicleCard
      year={vehicle?.year}
      make={vehicle?.make}
      model={vehicle?.model}
      trim={vehicle?.trim}
      imageSrc={vehicle?.images?.[0] || null}
      mileage={vehicle?.mileage}
      bodyStyle={vehicle?.bodyStyle}
      price={inventoryItem?.price}
      priceLabel="Est. OTD Price"
      dealerName={dealer?.businessName}
      dealerLocation={dealerLocation}
      chips={chips}
      onAddToShortlist={onAddToShortlist}
      isInShortlist={isInShortlist}
    />
  )
}
