-- FDC Vitaminas — Replenishment Worker
-- Migration 001: Initial schema

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Idempotency table for incoming Shopify webhooks
CREATE TABLE IF NOT EXISTS processed_webhooks (
  webhook_id   TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Main schedule table: one row per (order, variant) pair
CREATE TABLE IF NOT EXISTS replenishment_schedules (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            TEXT        NOT NULL,
  order_name          TEXT,
  customer_id         TEXT        NOT NULL,
  customer_email      TEXT        NOT NULL,
  customer_first_name TEXT,
  accepts_marketing   BOOLEAN     NOT NULL DEFAULT FALSE,
  product_id          TEXT        NOT NULL,
  variant_id          TEXT        NOT NULL,
  sku                 TEXT        NOT NULL,
  product_title       TEXT        NOT NULL,
  product_url         TEXT,
  image_url           TEXT,
  consumption_days    INTEGER     NOT NULL,
  trigger_date        TIMESTAMPTZ NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'scheduled',
  status_reason       TEXT,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_order_variant UNIQUE (order_id, variant_id),
  CONSTRAINT chk_status CHECK (status IN (
    'scheduled',
    'processing',
    'sent',
    'failed',
    'skipped_no_consent',
    'skipped_reordered',
    'skipped_out_of_stock',
    'skipped_inactive_product',
    'skipped_no_email'
  ))
);

CREATE INDEX IF NOT EXISTS idx_schedules_status_trigger
  ON replenishment_schedules (status, trigger_date);

CREATE INDEX IF NOT EXISTS idx_schedules_customer
  ON replenishment_schedules (customer_id);

CREATE INDEX IF NOT EXISTS idx_schedules_sku
  ON replenishment_schedules (sku);

-- Append-only audit log
CREATE TABLE IF NOT EXISTS replenishment_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID        REFERENCES replenishment_schedules (id) ON DELETE CASCADE,
  event       TEXT        NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_schedule
  ON replenishment_logs (schedule_id);

-- Auto-update updated_at on replenishment_schedules
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedules_updated_at ON replenishment_schedules;
CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON replenishment_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
