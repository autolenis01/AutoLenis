// Barrel export file for all services
// This ensures all exports are properly recognized by the deployment system

// Auth Services
export { AuthService, authService } from "./auth.service"
export { EmailVerificationService, emailVerificationService } from "./email-verification.service"
export { PasswordResetService, passwordResetService } from "./password-reset.service"

// Communication Services
export { EmailService, emailService } from "./email.service"

// Payment & Financial Services
export { PaymentService, paymentService } from "./payment.service"
export { PreQualService, prequalService } from "./prequal.service"

// Admin Services
export { AdminService, adminService } from "./admin.service"

// Inventory & Vehicle Services
export { InventoryService, inventoryService } from "./inventory.service"
export { ShortlistService, shortlistService } from "./shortlist.service"
export { AuctionService, auctionService } from "./auction.service"

// User Services
export { buyerService, BuyerService } from "./buyer.service"
export { DealerService, dealerService } from "./dealer.service"
export { DealerApprovalService, dealerApprovalService } from "./dealer-approval.service"
export { AffiliateService, affiliateService } from "./affiliate.service"

// Deal & Transaction Services
export { DealService, dealService } from "./deal.service"
export { OfferService, offerService } from "./offer.service"
export { BestPriceService, bestPriceService } from "./best-price.service"
export { PickupService, pickupService } from "./pickup.service"

// Contract & Compliance Services
export { ContractShieldService, contractShieldService } from "./contract-shield.service"
export { ESignService, esignService } from "./esign.service"
export { InsuranceService, insuranceService } from "./insurance.service"

// SEO Services
export { SEOService, seoService } from "./seo.service"

// Sourcing Services
export { SourcingService, sourcingService } from "./sourcing.service"

// Dealer Discovery & Source Services
export * as dealerDiscoveryService from "./dealer-discovery.service"
export * as dealerSourceService from "./dealer-source.service"

// Inventory Pipeline Services
export * as inventoryNormalizeService from "./inventory-normalize.service"
export * as inventoryDedupeService from "./inventory-dedupe.service"

// Identity & Protection Services
export * as identityFirewallService from "./identity-firewall.service"
export * as circumventionMonitorService from "./circumvention-monitor.service"
