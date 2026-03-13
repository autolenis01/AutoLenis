-- =============================================================================
-- Migration: 20250313000000_new_migration
-- AutoLenis — Baseline integration migration
-- Equivalent to: supabase migration new new-migration && supabase db push
--
-- This migration records the full set of DDL changes applied during the
-- Supabase integration session.  Every statement is idempotent so it is
-- safe to run against a database that already has the changes applied.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Prisma directUrl: already reflected in prisma/schema.prisma
--    (datasource.directUrl = env("POSTGRES_URL_NON_POOLING"))
--    No SQL needed — Prisma handles this at generate/migrate time.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2. is_admin() — rebuild as SECURITY DEFINER (no-arg, canonical version)
--    Drops the legacy is_admin(uuid) overload that referenced "AdminUser"
--    and was callable only with an explicit argument (never from RLS USING).
-- ---------------------------------------------------------------------------

-- Drop legacy parametrised overload
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- Canonical zero-arg SECURITY DEFINER version
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.app_admins a
    WHERE  a.user_id = (SELECT auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. is_super_admin() — rebuild as SECURITY DEFINER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'role') = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1
      FROM   public.app_admins a
      WHERE  a.user_id = auth.uid()
        AND  a.role_type = 'SUPER_ADMIN'
    )
  , false);
$$;

-- ---------------------------------------------------------------------------
-- 4. Fix circular admins_read_all policy on app_admins
--    Old: self-referential EXISTS subquery back into app_admins
--    New: delegates to the SECURITY DEFINER helper functions above
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS admins_read_all ON public.app_admins;

CREATE POLICY admins_read_all ON public.app_admins
  FOR SELECT TO authenticated
  USING (is_admin() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 5. RLS policies for PascalCase Prisma-managed tables (Part 1 — 37 tables)
--    All policies are guarded with IF NOT EXISTS to be fully idempotent.
-- ---------------------------------------------------------------------------

DO $$
BEGIN

  -- User
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='User' AND policyname='User_select_own') THEN
    EXECUTE $p$CREATE POLICY "User_select_own" ON "User" FOR SELECT TO authenticated USING (id = auth.uid());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='User' AND policyname='User_update_own') THEN
    EXECUTE $p$CREATE POLICY "User_update_own" ON "User" FOR UPDATE TO authenticated USING (id = auth.uid());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='User' AND policyname='User_admin_all') THEN
    EXECUTE $p$CREATE POLICY "User_admin_all" ON "User" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- AdminUser
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AdminUser' AND policyname='AdminUser_admin_all') THEN
    EXECUTE $p$CREATE POLICY "AdminUser_admin_all" ON "AdminUser" FOR ALL TO authenticated USING (userid = auth.uid() OR is_admin() OR is_super_admin());$p$;
  END IF;

  -- AdminAuditLog
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AdminAuditLog' AND policyname='AdminAuditLog_admin_read') THEN
    EXECUTE $p$CREATE POLICY "AdminAuditLog_admin_read" ON "AdminAuditLog" FOR SELECT TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AdminAuditLog' AND policyname='AdminAuditLog_system_insert') THEN
    EXECUTE $p$CREATE POLICY "AdminAuditLog_system_insert" ON "AdminAuditLog" FOR INSERT TO authenticated WITH CHECK (true);$p$;
  END IF;

  -- AdminNotification
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AdminNotification' AND policyname='AdminNotification_admin_all') THEN
    EXECUTE $p$CREATE POLICY "AdminNotification_admin_all" ON "AdminNotification" FOR ALL TO authenticated USING (adminid = auth.uid() OR is_admin() OR is_super_admin());$p$;
  END IF;

  -- Affiliate
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Affiliate' AND policyname='Affiliate_user_own') THEN
    EXECUTE $p$CREATE POLICY "Affiliate_user_own" ON "Affiliate" FOR ALL TO authenticated USING (userid = auth.uid() OR is_admin() OR is_super_admin());$p$;
  END IF;

  -- AffiliateDocument
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AffiliateDocument' AND policyname='AffiliateDocument_admin_all') THEN
    EXECUTE $p$CREATE POLICY "AffiliateDocument_admin_all" ON "AffiliateDocument" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- AiConversation
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AiConversation' AND policyname='AiConversation_user_own') THEN
    EXECUTE $p$CREATE POLICY "AiConversation_user_own" ON "AiConversation" FOR ALL TO authenticated USING (userid = auth.uid() OR is_admin());$p$;
  END IF;

  -- AiMessage
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AiMessage' AND policyname='AiMessage_conversation_owner') THEN
    EXECUTE $p$CREATE POLICY "AiMessage_conversation_owner" ON "AiMessage" FOR ALL TO authenticated USING (conversationid IN (SELECT id FROM "AiConversation" WHERE userid = auth.uid()) OR is_admin());$p$;
  END IF;

  -- Auction
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Auction' AND policyname='Auction_buyer_own') THEN
    EXECUTE $p$CREATE POLICY "Auction_buyer_own" ON "Auction" FOR ALL TO authenticated USING (buyerid IN (SELECT id FROM "BuyerProfile" WHERE userid = auth.uid()) OR is_admin());$p$;
  END IF;

  -- AuctionOffer
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AuctionOffer' AND policyname='AuctionOffer_parties') THEN
    EXECUTE $p$CREATE POLICY "AuctionOffer_parties" ON "AuctionOffer" FOR ALL TO authenticated USING (participantid IN (SELECT id FROM "AuctionParticipant" WHERE dealerid IN (SELECT dealerid FROM "DealerUser" WHERE userid = auth.uid())) OR auctionid IN (SELECT id FROM "Auction" WHERE buyerid IN (SELECT id FROM "BuyerProfile" WHERE userid = auth.uid())) OR is_admin());$p$;
  END IF;

  -- AuctionParticipant
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AuctionParticipant' AND policyname='AuctionParticipant_dealer_own') THEN
    EXECUTE $p$CREATE POLICY "AuctionParticipant_dealer_own" ON "AuctionParticipant" FOR ALL TO authenticated USING (dealerid IN (SELECT dealerid FROM "DealerUser" WHERE userid = auth.uid()) OR is_admin());$p$;
  END IF;

  -- BestPriceOption
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='BestPriceOption' AND policyname='BestPriceOption_admin_all') THEN
    EXECUTE $p$CREATE POLICY "BestPriceOption_admin_all" ON "BestPriceOption" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- BuyerPreferences
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='BuyerPreferences' AND policyname='BuyerPreferences_user_own') THEN
    EXECUTE $p$CREATE POLICY "BuyerPreferences_user_own" ON "BuyerPreferences" FOR ALL TO authenticated USING (buyerid IN (SELECT id FROM "BuyerProfile" WHERE userid = auth.uid()) OR is_admin());$p$;
  END IF;

  -- BuyerProfile
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='BuyerProfile' AND policyname='BuyerProfile_user_own') THEN
    EXECUTE $p$CREATE POLICY "BuyerProfile_user_own" ON "BuyerProfile" FOR ALL TO authenticated USING (userid = auth.uid() OR is_admin());$p$;
  END IF;

  -- Commission
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Commission' AND policyname='Commission_admin_all') THEN
    EXECUTE $p$CREATE POLICY "Commission_admin_all" ON "Commission" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- DealDocument
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='DealDocument' AND policyname='DealDocument_admin_all') THEN
    EXECUTE $p$CREATE POLICY "DealDocument_admin_all" ON "DealDocument" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- Dealer
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Dealer' AND policyname='Dealer_self_read') THEN
    EXECUTE $p$CREATE POLICY "Dealer_self_read" ON "Dealer" FOR SELECT TO authenticated USING (id IN (SELECT dealerid FROM "DealerUser" WHERE userid = auth.uid()) OR is_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Dealer' AND policyname='Dealer_admin_write') THEN
    EXECUTE $p$CREATE POLICY "Dealer_admin_write" ON "Dealer" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- DealerUser
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='DealerUser' AND policyname='DealerUser_own') THEN
    EXECUTE $p$CREATE POLICY "DealerUser_own" ON "DealerUser" FOR ALL TO authenticated USING (userid = auth.uid() OR is_admin());$p$;
  END IF;

  -- DepositPayment
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='DepositPayment' AND policyname='DepositPayment_admin_all') THEN
    EXECUTE $p$CREATE POLICY "DepositPayment_admin_all" ON "DepositPayment" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- DocumentRequest
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='DocumentRequest' AND policyname='DocumentRequest_admin_all') THEN
    EXECUTE $p$CREATE POLICY "DocumentRequest_admin_all" ON "DocumentRequest" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- ESignEnvelope
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ESignEnvelope' AND policyname='ESignEnvelope_admin_all') THEN
    EXECUTE $p$CREATE POLICY "ESignEnvelope_admin_all" ON "ESignEnvelope" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- EmailLog (PascalCase table)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='EmailLog' AND policyname='EmailLog_admin_read') THEN
    EXECUTE $p$CREATE POLICY "EmailLog_admin_read" ON "EmailLog" FOR SELECT TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='EmailLog' AND policyname='EmailLog_system_insert') THEN
    EXECUTE $p$CREATE POLICY "EmailLog_system_insert" ON "EmailLog" FOR INSERT TO authenticated WITH CHECK (true);$p$;
  END IF;

  -- EmailSendLog
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='EmailSendLog' AND policyname='EmailSendLog_admin_read') THEN
    EXECUTE $p$CREATE POLICY "EmailSendLog_admin_read" ON "EmailSendLog" FOR SELECT TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='EmailSendLog' AND policyname='EmailSendLog_system_insert') THEN
    EXECUTE $p$CREATE POLICY "EmailSendLog_system_insert" ON "EmailSendLog" FOR INSERT TO authenticated WITH CHECK (true);$p$;
  END IF;

  -- FinancingOffer
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='FinancingOffer' AND policyname='FinancingOffer_admin_all') THEN
    EXECUTE $p$CREATE POLICY "FinancingOffer_admin_all" ON "FinancingOffer" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- InsurancePolicy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='InsurancePolicy' AND policyname='InsurancePolicy_admin_all') THEN
    EXECUTE $p$CREATE POLICY "InsurancePolicy_admin_all" ON "InsurancePolicy" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- InsuranceQuote
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='InsuranceQuote' AND policyname='InsuranceQuote_admin_all') THEN
    EXECUTE $p$CREATE POLICY "InsuranceQuote_admin_all" ON "InsuranceQuote" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- InventoryItem
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='InventoryItem' AND policyname='InventoryItem_public_read') THEN
    EXECUTE $p$CREATE POLICY "InventoryItem_public_read" ON "InventoryItem" FOR SELECT TO anon, authenticated USING (true);$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='InventoryItem' AND policyname='InventoryItem_dealer_write') THEN
    EXECUTE $p$CREATE POLICY "InventoryItem_dealer_write" ON "InventoryItem" FOR ALL TO authenticated USING (dealerid IN (SELECT dealerid FROM "DealerUser" WHERE userid = auth.uid()) OR is_admin());$p$;
  END IF;

  -- LenderFeeDisbursement
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='LenderFeeDisbursement' AND policyname='LenderFeeDisbursement_admin_all') THEN
    EXECUTE $p$CREATE POLICY "LenderFeeDisbursement_admin_all" ON "LenderFeeDisbursement" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- PaymentMethod
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='PaymentMethod' AND policyname='PaymentMethod_user_own') THEN
    EXECUTE $p$CREATE POLICY "PaymentMethod_user_own" ON "PaymentMethod" FOR ALL TO authenticated USING (userid = auth.uid() OR is_admin());$p$;
  END IF;

  -- Payout
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Payout' AND policyname='Payout_admin_all') THEN
    EXECUTE $p$CREATE POLICY "Payout_admin_all" ON "Payout" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- PickupAppointment
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='PickupAppointment' AND policyname='PickupAppointment_admin_all') THEN
    EXECUTE $p$CREATE POLICY "PickupAppointment_admin_all" ON "PickupAppointment" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- SelectedDeal
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='SelectedDeal' AND policyname='SelectedDeal_buyer_own') THEN
    EXECUTE $p$CREATE POLICY "SelectedDeal_buyer_own" ON "SelectedDeal" FOR SELECT TO authenticated USING (buyerid IN (SELECT id FROM "BuyerProfile" WHERE userid = auth.uid()) OR dealerid IN (SELECT dealerid FROM "DealerUser" WHERE userid = auth.uid()) OR is_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='SelectedDeal' AND policyname='SelectedDeal_admin_write') THEN
    EXECUTE $p$CREATE POLICY "SelectedDeal_admin_write" ON "SelectedDeal" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- ServiceFeePayment
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ServiceFeePayment' AND policyname='ServiceFeePayment_admin_all') THEN
    EXECUTE $p$CREATE POLICY "ServiceFeePayment_admin_all" ON "ServiceFeePayment" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- Shortlist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Shortlist' AND policyname='Shortlist_buyer_own') THEN
    EXECUTE $p$CREATE POLICY "Shortlist_buyer_own" ON "Shortlist" FOR ALL TO authenticated USING (id IN (SELECT shortlistid FROM "Auction" WHERE buyerid IN (SELECT id FROM "BuyerProfile" WHERE userid = auth.uid())) OR is_admin());$p$;
  END IF;

  -- ShortlistItem
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ShortlistItem' AND policyname='ShortlistItem_buyer_own') THEN
    EXECUTE $p$CREATE POLICY "ShortlistItem_buyer_own" ON "ShortlistItem" FOR ALL TO authenticated USING (shortlistid IN (SELECT id FROM "Shortlist") OR is_admin());$p$;
  END IF;

  -- Vehicle
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Vehicle' AND policyname='Vehicle_public_read') THEN
    EXECUTE $p$CREATE POLICY "Vehicle_public_read" ON "Vehicle" FOR SELECT TO anon, authenticated USING (true);$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Vehicle' AND policyname='Vehicle_admin_write') THEN
    EXECUTE $p$CREATE POLICY "Vehicle_admin_write" ON "Vehicle" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- Workspace
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Workspace' AND policyname='Workspace_admin_all') THEN
    EXECUTE $p$CREATE POLICY "Workspace_admin_all" ON "Workspace" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

END $$;

-- ---------------------------------------------------------------------------
-- 6. RLS policies for snake_case locked-out tables (Part 2 — 20 tables)
-- ---------------------------------------------------------------------------

DO $$
BEGIN

  -- _diag_car_requests_buyer_backfill
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='_diag_car_requests_buyer_backfill' AND policyname='diag_admin_all') THEN
    EXECUTE $p$CREATE POLICY "diag_admin_all" ON "_diag_car_requests_buyer_backfill" FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- car_request_activity
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='car_request_activity' AND policyname='car_request_activity_admin_all') THEN
    EXECUTE $p$CREATE POLICY "car_request_activity_admin_all" ON car_request_activity FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- car_request_documents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='car_request_documents' AND policyname='car_request_documents_admin_all') THEN
    EXECUTE $p$CREATE POLICY "car_request_documents_admin_all" ON car_request_documents FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- car_request_tradeins
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='car_request_tradeins' AND policyname='car_request_tradeins_admin_all') THEN
    EXECUTE $p$CREATE POLICY "car_request_tradeins_admin_all" ON car_request_tradeins FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- car_requests
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='car_requests' AND policyname='car_requests_buyer_own') THEN
    EXECUTE $p$CREATE POLICY "car_requests_buyer_own" ON car_requests FOR ALL TO authenticated USING (buyerid IN (SELECT id FROM "BuyerProfile" WHERE userid = auth.uid()) OR is_admin());$p$;
  END IF;

  -- contact_messages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contact_messages' AND policyname='contact_messages_public_insert') THEN
    EXECUTE $p$CREATE POLICY "contact_messages_public_insert" ON contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contact_messages' AND policyname='contact_messages_admin_read') THEN
    EXECUTE $p$CREATE POLICY "contact_messages_admin_read" ON contact_messages FOR SELECT TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- email_log (snake_case)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_log' AND policyname='email_log_admin_read') THEN
    EXECUTE $p$CREATE POLICY "email_log_admin_read" ON email_log FOR SELECT TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_log' AND policyname='email_log_system_insert') THEN
    EXECUTE $p$CREATE POLICY "email_log_system_insert" ON email_log FOR INSERT TO authenticated WITH CHECK (true);$p$;
  END IF;

  -- email_outbox
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_outbox' AND policyname='email_outbox_admin_read') THEN
    EXECUTE $p$CREATE POLICY "email_outbox_admin_read" ON email_outbox FOR SELECT TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_outbox' AND policyname='email_outbox_system_insert') THEN
    EXECUTE $p$CREATE POLICY "email_outbox_system_insert" ON email_outbox FOR INSERT TO authenticated WITH CHECK (true);$p$;
  END IF;

  -- network_coverage_events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='network_coverage_events' AND policyname='network_coverage_events_admin_all') THEN
    EXECUTE $p$CREATE POLICY "network_coverage_events_admin_all" ON network_coverage_events FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- notification_events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_events' AND policyname='notification_events_admin_read') THEN
    EXECUTE $p$CREATE POLICY "notification_events_admin_read" ON notification_events FOR SELECT TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_events' AND policyname='notification_events_system_insert') THEN
    EXECUTE $p$CREATE POLICY "notification_events_system_insert" ON notification_events FOR INSERT TO authenticated WITH CHECK (true);$p$;
  END IF;

  -- payout_deals
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payout_deals' AND policyname='payout_deals_admin_all') THEN
    EXECUTE $p$CREATE POLICY "payout_deals_admin_all" ON payout_deals FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- seo_health
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seo_health' AND policyname='seo_health_public_read') THEN
    EXECUTE $p$CREATE POLICY "seo_health_public_read" ON seo_health FOR SELECT TO anon, authenticated USING (true);$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seo_health' AND policyname='seo_health_admin_write') THEN
    EXECUTE $p$CREATE POLICY "seo_health_admin_write" ON seo_health FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- seo_keywords
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seo_keywords' AND policyname='seo_keywords_public_read') THEN
    EXECUTE $p$CREATE POLICY "seo_keywords_public_read" ON seo_keywords FOR SELECT TO anon, authenticated USING (true);$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seo_keywords' AND policyname='seo_keywords_admin_write') THEN
    EXECUTE $p$CREATE POLICY "seo_keywords_admin_write" ON seo_keywords FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- seo_pages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seo_pages' AND policyname='seo_pages_public_read') THEN
    EXECUTE $p$CREATE POLICY "seo_pages_public_read" ON seo_pages FOR SELECT TO anon, authenticated USING (true);$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seo_pages' AND policyname='seo_pages_admin_write') THEN
    EXECUTE $p$CREATE POLICY "seo_pages_admin_write" ON seo_pages FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- seo_schema
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seo_schema' AND policyname='seo_schema_public_read') THEN
    EXECUTE $p$CREATE POLICY "seo_schema_public_read" ON seo_schema FOR SELECT TO anon, authenticated USING (true);$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seo_schema' AND policyname='seo_schema_admin_write') THEN
    EXECUTE $p$CREATE POLICY "seo_schema_admin_write" ON seo_schema FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- sourced_dealer_invitations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sourced_dealer_invitations' AND policyname='sourced_dealer_invitations_admin_all') THEN
    EXECUTE $p$CREATE POLICY "sourced_dealer_invitations_admin_all" ON sourced_dealer_invitations FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- sourced_offers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sourced_offers' AND policyname='sourced_offers_admin_all') THEN
    EXECUTE $p$CREATE POLICY "sourced_offers_admin_all" ON sourced_offers FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- sourcing_audit_log
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sourcing_audit_log' AND policyname='sourcing_audit_log_admin_read') THEN
    EXECUTE $p$CREATE POLICY "sourcing_audit_log_admin_read" ON sourcing_audit_log FOR SELECT TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sourcing_audit_log' AND policyname='sourcing_audit_log_system_insert') THEN
    EXECUTE $p$CREATE POLICY "sourcing_audit_log_system_insert" ON sourcing_audit_log FOR INSERT TO authenticated WITH CHECK (true);$p$;
  END IF;

  -- sourcing_cases
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sourcing_cases' AND policyname='sourcing_cases_admin_all') THEN
    EXECUTE $p$CREATE POLICY "sourcing_cases_admin_all" ON sourcing_cases FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- sourcing_dealer_outreach
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sourcing_dealer_outreach' AND policyname='sourcing_dealer_outreach_admin_all') THEN
    EXECUTE $p$CREATE POLICY "sourcing_dealer_outreach_admin_all" ON sourcing_dealer_outreach FOR ALL TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;

  -- sourcing_events_outbox
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sourcing_events_outbox' AND policyname='sourcing_events_outbox_admin_read') THEN
    EXECUTE $p$CREATE POLICY "sourcing_events_outbox_admin_read" ON sourcing_events_outbox FOR SELECT TO authenticated USING (is_admin() OR is_super_admin());$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sourcing_events_outbox' AND policyname='sourcing_events_outbox_system_insert') THEN
    EXECUTE $p$CREATE POLICY "sourcing_events_outbox_system_insert" ON sourcing_events_outbox FOR INSERT TO authenticated WITH CHECK (true);$p$;
  END IF;

END $$;
