import { prisma } from "@/lib/db"
import { getSelectedDealForBuyer } from "./retrieval"
import { advanceDealStatusIfReady } from "./status"

export async function selectInsuranceQuote(userId: string, dealId: string, quoteId: string) {
  const dealData = await getSelectedDealForBuyer(userId, dealId)
  const deal = dealData.deal

  if (deal.status === "COMPLETED" || deal.status === "CANCELLED") {
    throw new Error("Cannot modify completed or cancelled deal")
  }

  // Verify quote belongs to this deal's buyer
  const quote = await prisma.insuranceQuote.findUnique({
    where: { id: quoteId },
  })
  if (!quote || quote.buyerId !== deal.buyerId) {
    throw new Error("Insurance quote not found or does not belong to this buyer")
  }

  // Create or update policy
  const policy = await prisma.insurancePolicy.upsert({
    where: { dealId },
    create: {
      dealId,
      status: "POLICY_SELECTED",
      carrier: quote.carrier,
      policyNumber: "POL-" + crypto.randomUUID().replace(/-/g, "").substring(0, 10).toUpperCase(),
      coverageType: quote.coverageType || "FULL",
      monthlyPremium: quote.monthlyPremium,
      effectiveDate: new Date(),
      expirationDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      status: "POLICY_SELECTED",
      carrier: quote.carrier,
      coverageType: quote.coverageType || "FULL",
      monthlyPremium: quote.monthlyPremium,
      effectiveDate: new Date(),
    },
  })

  // Update deal
  await prisma.selectedDeal.update({
    where: { id: dealId },
    data: {
      insurance_status: "SELECTED_AUTOLENIS",
    },
  })

  // Log compliance event
  await prisma.complianceEvent.create({
    data: {
      eventType: "INSURANCE_SELECTED",
      type: "INSURANCE_AUTOLENIS",
      userId,
      relatedId: dealId,
      details: {
        quoteId,
        carrier: policy.carrier,
        policyNumber: policy.policyNumber,
      },
    },
  })

  // Try to advance status
  await advanceDealStatusIfReady(dealId, userId)

  return policy
}

export async function uploadExternalInsuranceProof(
  userId: string,
  dealId: string,
  carrierName: string,
  policyNumber: string,
  documentUrl: string,
) {
  const dealData = await getSelectedDealForBuyer(userId, dealId)
  const deal = dealData.deal

  if (deal.status === "COMPLETED" || deal.status === "CANCELLED") {
    throw new Error("Cannot modify completed or cancelled deal")
  }

  // Create or update policy
  const policy = await prisma.insurancePolicy.upsert({
    where: { dealId },
    create: {
      dealId,
      status: "EXTERNAL_UPLOADED",
      type: "EXTERNAL",
      carrier: carrierName,
      policyNumber,
      documentUrl,
      coverageType: "EXTERNAL",
      effectiveDate: new Date(),
      expirationDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      status: "EXTERNAL_UPLOADED",
      carrier: carrierName,
      policyNumber,
      documentUrl,
    },
  })

  // Update deal
  await prisma.selectedDeal.update({
    where: { id: dealId },
    data: {
      insurance_status: "EXTERNAL_PROOF_UPLOADED",
    },
  })

  // Log compliance event
  await prisma.complianceEvent.create({
    data: {
      eventType: "INSURANCE_UPLOADED",
      type: "INSURANCE_EXTERNAL",
      userId,
      relatedId: dealId,
      details: {
        carrierName,
        policyNumber,
        documentUrl,
      },
    },
  })

  // Try to advance status
  await advanceDealStatusIfReady(dealId, userId)

  return policy
}
