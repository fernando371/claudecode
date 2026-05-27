export type ScheduleStatus =
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'skipped_no_consent'
  | 'skipped_reordered'
  | 'skipped_out_of_stock'
  | 'skipped_inactive_product'
  | 'skipped_no_email';

export interface ReplenishmentSchedule {
  id: string;
  order_id: string;
  order_name: string | null;
  customer_id: string;
  customer_email: string;
  customer_first_name: string | null;
  accepts_marketing: boolean;
  product_id: string;
  variant_id: string;
  sku: string;
  product_title: string;
  product_url: string | null;
  image_url: string | null;
  consumption_days: number;
  trigger_date: Date;
  status: ScheduleStatus;
  status_reason: string | null;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ShopifyOrderWebhook {
  id: number;
  name: string;
  email: string;
  created_at: string;
  processed_at: string | null;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    accepts_marketing: boolean;
  } | null;
  line_items: ShopifyLineItem[];
}

export interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  sku: string;
  title: string;
  quantity: number;
}

export interface ProductMetafields {
  enabled: boolean;
  consumption_days: number;
  reminder_delay_days: number;
  source: string | null;
}

export interface ProductInfo {
  id: string;
  title: string;
  status: string;
  handle: string;
  featuredImage: { url: string } | null;
  metafields: ProductMetafields | null;
  totalInventory: number;
}

export interface EmailTemplateVars {
  customer_first_name: string;
  product_title: string;
  product_url: string;
  image_url: string;
  consumption_days: number;
  shop_name: string;
  unsubscribe_url: string;
}
