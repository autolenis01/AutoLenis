-- Unified buyer qualification view
-- Combines active PreQualification records and approved ExternalPreApprovalSubmission
-- records into a single view for the buyer prequal API route.
-- Column names are snake_case for consistency with other SQL-created views.

CREATE OR REPLACE VIEW buyer_qualification_active AS
SELECT
  pq."buyerId"                   AS buyer_id,
  pq."id"                        AS qualification_id,
  pq."status"                    AS qualification_status,
  pq."creditTier"::text          AS credit_tier,
  pq."maxOtdAmountCents"         AS max_otd_amount_cents,
  pq."minMonthlyPaymentCents"    AS min_monthly_payment_cents,
  pq."maxMonthlyPaymentCents"    AS max_monthly_payment_cents,
  COALESCE(pq."dtiRatio", pq."dti") AS dti_ratio,
  pq."expiresAt"                 AS expires_at,
  pq."providerName"              AS provider_name,
  pq."source"::text              AS qualification_source,
  pq."createdAt"                 AS created_at,
  CASE
    WHEN pq."status" = 'ACTIVE' AND pq."expiresAt" > NOW() THEN true
    ELSE false
  END                            AS is_active
FROM "PreQualification" pq

UNION ALL

SELECT
  eps."buyerId"                  AS buyer_id,
  eps."id"                       AS qualification_id,
  eps."status"::text             AS qualification_status,
  NULL                           AS credit_tier,
  eps."maxOtdAmountCents"        AS max_otd_amount_cents,
  eps."minMonthlyPaymentCents"   AS min_monthly_payment_cents,
  eps."maxMonthlyPaymentCents"   AS max_monthly_payment_cents,
  CASE
    WHEN eps."dtiRatioBps" IS NOT NULL
    THEN eps."dtiRatioBps"::numeric / 100
    ELSE NULL
  END                            AS dti_ratio,
  eps."expiresAt"                AS expires_at,
  eps."lenderName"               AS provider_name,
  'EXTERNAL_MANUAL'              AS qualification_source,
  eps."createdAt"                AS created_at,
  CASE
    WHEN eps."status" = 'APPROVED'
         AND (eps."expiresAt" IS NULL OR eps."expiresAt" > NOW())
    THEN true
    ELSE false
  END                            AS is_active
FROM "ExternalPreApprovalSubmission" eps
WHERE eps."status" = 'APPROVED';
