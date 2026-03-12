"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Package, Plus, Search, MoreVertical, Edit, Trash2, Eye, AlertCircle, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { csrfHeaders } from "@/lib/csrf-client"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function DealerInventoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data, error, isLoading, mutate } = useSWR("/api/dealer/inventory", fetcher, {
    refreshInterval: 30000,
  })

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this vehicle from inventory?")) return

    setDeleting(id)
    try {
      const res = await fetch(`/api/dealer/inventory/${id}`, { method: "DELETE", headers: csrfHeaders() })
      if (res.ok) {
        toast({ title: "Vehicle removed from inventory" })
        mutate()
      } else {
        throw new Error("Failed to delete")
      }
    } catch {
      toast({ variant: "destructive", title: "Failed to remove vehicle" })
    } finally {
      setDeleting(null)
    }
  }

  const inventory = data?.inventory || []
  const filteredInventory = inventory.filter((item: any) => {
    const vehicle = item.vehicle
    const searchLower = search.toLowerCase()
    return (
      vehicle.make?.toLowerCase().includes(searchLower) ||
      vehicle.model?.toLowerCase().includes(searchLower) ||
      vehicle.vin?.toLowerCase().includes(searchLower) ||
      item.stockNumber?.toLowerCase().includes(searchLower)
    )
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-muted rounded mb-2" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 w-48 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to load inventory</h2>
        <p className="text-muted-foreground">Please try refreshing the page</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            Inventory Management
          </h1>
          <p className="text-muted-foreground mt-1">
            {inventory.length} vehicle{inventory.length !== 1 ? "s" : ""} in stock
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => router.push("/dealer/inventory/bulk-upload")}
            variant="outline"
            className="border-primary text-primary"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button
            onClick={() => router.push("/dealer/inventory/add")}
            className="bg-gradient-to-r from-[#7ED321] to-[#00D9FF] text-primary font-semibold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by make, model, VIN, or stock number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Vehicles</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInventory.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {search ? "No vehicles match your search" : "No vehicles in inventory"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {search ? "Try a different search term" : "Add your first vehicle to get started"}
              </p>
              {!search && (
                <Button onClick={() => router.push("/dealer/inventory/add")} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vehicle
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-sm">Vehicle</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">VIN</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Stock #</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Price</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-medium">
                          {item.vehicle.year} {item.vehicle.make} {item.vehicle.model}
                        </div>
                        <div className="text-sm text-muted-foreground">{item.vehicle.trim}</div>
                      </td>
                      <td className="py-4 px-4 text-sm font-mono text-muted-foreground">{item.vehicle.vin}</td>
                      <td className="py-4 px-4 text-sm">{item.stockNumber}</td>
                      <td className="py-4 px-4 font-semibold">${(item.price || 0).toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            item.status === "AVAILABLE"
                              ? "bg-[#7ED321]/10 text-[#7ED321]"
                              : item.status === "PENDING"
                                ? "bg-yellow-500/10 text-yellow-600"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dealer/inventory/${item.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/dealer/inventory/${item.id}/edit`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(item.id)}
                              disabled={deleting === item.id}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {deleting === item.id ? "Removing..." : "Remove"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
