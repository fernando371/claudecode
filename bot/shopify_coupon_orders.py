#!/usr/bin/env python3
"""Daily Shopify coupon orders report — sends HTML email to comercial@biowellamerica.com.br"""

import os
import smtplib
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


SHOPIFY_STORE_URL = os.environ["SHOPIFY_STORE_URL"]       # ex: fdc.myshopify.com
SHOPIFY_ACCESS_TOKEN = os.environ["SHOPIFY_ACCESS_TOKEN"]  # Admin API token

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ["SMTP_USER"]
SMTP_PASSWORD = os.environ["SMTP_PASSWORD"]
EMAIL_FROM = os.environ.get("EMAIL_FROM", SMTP_USER)
EMAIL_TO = os.environ.get("EMAIL_TO", "comercial@biowellamerica.com.br")

# BRT = UTC-3
BRT = timezone(timedelta(hours=-3))


def graphql(query: str, variables: dict | None = None) -> dict:
    url = f"https://{SHOPIFY_STORE_URL}/admin/api/2024-10/graphql.json"
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


ORDERS_QUERY = """
query ordersWithCoupons($after: String, $query: String!) {
  orders(first: 250, after: $after, query: $query) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        name
        createdAt
        totalPrice
        customer { firstName lastName email }
        discountCodes
        discountApplications(first: 5) {
          edges {
            node {
              ... on DiscountCodeApplication {
                code
                value {
                  ... on PricingPercentageValue { percentage }
                  ... on MoneyV2 { amount currencyCode }
                }
              }
            }
          }
        }
        totalDiscountsSet { shopMoney { amount } }
      }
    }
  }
}
"""


def fetch_coupon_orders(date_start: datetime, date_end: datetime) -> list[dict]:
    # Shopify query filter uses UTC
    start_str = date_start.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    end_str = date_end.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    query_filter = f"created_at:>={start_str} created_at:<={end_str} discount_code:*"

    orders = []
    cursor = None

    while True:
        result = graphql(ORDERS_QUERY, {"after": cursor, "query": query_filter})
        data = result.get("data", {}).get("orders", {})
        for edge in data.get("edges", []):
            node = edge["node"]
            if not node.get("discountCodes"):
                continue
            discount_apps = [
                e["node"]
                for e in node["discountApplications"]["edges"]
                if e["node"].get("code")
            ]
            for app in discount_apps:
                val = app.get("value", {})
                discount_type = "%" if "percentage" in val else "R$"
                discount_value = val.get("percentage") or val.get("amount", "0")
                orders.append({
                    "order": node["name"],
                    "created_at": node["createdAt"],
                    "customer": f"{(node.get('customer') or {}).get('firstName', '')} {(node.get('customer') or {}).get('lastName', '')}".strip() or "—",
                    "email": (node.get("customer") or {}).get("email", "—"),
                    "coupon": app["code"],
                    "discount_type": discount_type,
                    "discount_value": discount_value,
                    "total_discount_brl": node["totalDiscountsSet"]["shopMoney"]["amount"],
                    "order_total": node["totalPrice"],
                })
            if not discount_apps and node.get("discountCodes"):
                orders.append({
                    "order": node["name"],
                    "created_at": node["createdAt"],
                    "customer": f"{(node.get('customer') or {}).get('firstName', '')} {(node.get('customer') or {}).get('lastName', '')}".strip() or "—",
                    "email": (node.get("customer") or {}).get("email", "—"),
                    "coupon": ", ".join(node["discountCodes"]),
                    "discount_type": "—",
                    "discount_value": "—",
                    "total_discount_brl": node["totalDiscountsSet"]["shopMoney"]["amount"],
                    "order_total": node["totalPrice"],
                })

        page_info = data.get("pageInfo", {})
        if not page_info.get("hasNextPage"):
            break
        cursor = page_info["endCursor"]

    return orders


def fmt_brl(value: str) -> str:
    try:
        return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (ValueError, TypeError):
        return str(value)


def build_html(orders: list[dict], period_label: str) -> str:
    if not orders:
        body_content = "<p style='color:#555;font-size:15px;'>Nenhum pedido com cupom foi encontrado no período.</p>"
    else:
        # Summary by coupon
        summary: dict[str, dict] = {}
        for o in orders:
            c = o["coupon"]
            if c not in summary:
                summary[c] = {"count": 0, "total_discount": 0.0, "total_orders": 0.0}
            summary[c]["count"] += 1
            try:
                summary[c]["total_discount"] += float(o["total_discount_brl"])
                summary[c]["total_orders"] += float(o["order_total"])
            except (ValueError, TypeError):
                pass

        total_orders_count = len(set(o["order"] for o in orders))
        total_discount_sum = sum(s["total_discount"] for s in summary.values())

        summary_rows = "".join(
            f"<tr>"
            f"<td style='{TD}'><code style='background:#f0f4ff;padding:2px 6px;border-radius:4px;font-size:13px'>{c}</code></td>"
            f"<td style='{TD};text-align:center'>{v['count']}</td>"
            f"<td style='{TD};text-align:right;color:#c0392b'>{fmt_brl(v['total_discount'])}</td>"
            f"<td style='{TD};text-align:right'>{fmt_brl(v['total_orders'])}</td>"
            f"</tr>"
            for c, v in sorted(summary.items(), key=lambda x: -x[1]["count"])
        )

        detail_rows = "".join(
            f"<tr style='background:{'#fff' if i % 2 == 0 else '#f9f9f9'}'>"
            f"<td style='{TD}'>{o['order']}</td>"
            f"<td style='{TD}'>{_fmt_date(o['created_at'])}</td>"
            f"<td style='{TD}'>{o['customer']}</td>"
            f"<td style='{TD}'><a href='mailto:{o['email']}' style='color:#2471a3'>{o['email']}</a></td>"
            f"<td style='{TD}'><code style='background:#f0f4ff;padding:2px 6px;border-radius:4px;font-size:12px'>{o['coupon']}</code></td>"
            f"<td style='{TD};text-align:center'>{o['discount_value']}{o['discount_type']}</td>"
            f"<td style='{TD};text-align:right;color:#c0392b'>{fmt_brl(o['total_discount_brl'])}</td>"
            f"<td style='{TD};text-align:right;font-weight:bold'>{fmt_brl(o['order_total'])}</td>"
            f"</tr>"
            for i, o in enumerate(orders)
        )

        body_content = f"""
        <div style="margin-bottom:24px;display:flex;gap:20px;flex-wrap:wrap">
          <div style="{CARD}"><div style="font-size:13px;color:#888">Pedidos c/ cupom</div><div style="font-size:28px;font-weight:700;color:#1a5276">{total_orders_count}</div></div>
          <div style="{CARD}"><div style="font-size:13px;color:#888">Total descontos</div><div style="font-size:28px;font-weight:700;color:#c0392b">{fmt_brl(total_discount_sum)}</div></div>
          <div style="{CARD}"><div style="font-size:13px;color:#888">Cupons únicos</div><div style="font-size:28px;font-weight:700;color:#196f3d">{len(summary)}</div></div>
        </div>

        <h3 style="color:#1a5276;margin-bottom:8px">Resumo por cupom</h3>
        <table style="{TABLE}">
          <thead><tr style="background:#1a5276;color:#fff">
            <th style="{TH}">Cupom</th><th style="{TH}">Usos</th>
            <th style="{TH}">Desconto total</th><th style="{TH}">Receita gerada</th>
          </tr></thead>
          <tbody>{summary_rows}</tbody>
        </table>

        <h3 style="color:#1a5276;margin:24px 0 8px">Detalhamento de pedidos</h3>
        <table style="{TABLE}">
          <thead><tr style="background:#1a5276;color:#fff">
            <th style="{TH}">Pedido</th><th style="{TH}">Data</th><th style="{TH}">Cliente</th>
            <th style="{TH}">Email</th><th style="{TH}">Cupom</th>
            <th style="{TH}">Desconto</th><th style="{TH}">Valor desc.</th><th style="{TH}">Total</th>
          </tr></thead>
          <tbody>{detail_rows}</tbody>
        </table>
        """

    return f"""<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
    <div style="max-width:900px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
      <div style="background:#1a5276;padding:24px 32px">
        <h1 style="color:#fff;margin:0;font-size:22px">Pedidos com Cupom — FDC Vitaminas</h1>
        <p style="color:#aed6f1;margin:4px 0 0;font-size:14px">{period_label}</p>
      </div>
      <div style="padding:32px">{body_content}</div>
      <div style="background:#f0f0f0;padding:16px 32px;font-size:12px;color:#888;text-align:center">
        Relatório automático · fdc.com.br · Gerado em {datetime.now(BRT).strftime('%d/%m/%Y %H:%M')} BRT
      </div>
    </div>
    </body></html>"""


TD = "padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;vertical-align:top"
TH = "padding:10px 12px;text-align:left;font-size:13px;font-weight:600"
TABLE = "width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px"
CARD = "background:#f8f9fa;border-radius:8px;padding:16px 24px;min-width:160px;border:1px solid #e0e0e0"


def _fmt_date(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(BRT)
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return iso


def send_email(subject: str, html: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = EMAIL_TO
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(EMAIL_FROM, [EMAIL_TO], msg.as_bytes())
    print(f"Email enviado para {EMAIL_TO}")


def main():
    now_brt = datetime.now(BRT)
    # Yesterday full day in BRT
    yesterday_start = (now_brt - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_end = yesterday_start.replace(hour=23, minute=59, second=59)

    period_label = f"{yesterday_start.strftime('%d/%m/%Y')} (pedidos do dia anterior)"
    subject = f"[FDC] Pedidos com cupom — {yesterday_start.strftime('%d/%m/%Y')}"

    print(f"Buscando pedidos com cupom de {yesterday_start.strftime('%d/%m/%Y %H:%M')} a {yesterday_end.strftime('%d/%m/%Y %H:%M')} BRT...")
    orders = fetch_coupon_orders(yesterday_start, yesterday_end)
    print(f"Encontrados {len(orders)} registros (linhas de pedido com cupom)")

    html = build_html(orders, period_label)
    send_email(subject, html)


if __name__ == "__main__":
    main()
