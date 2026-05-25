#!/usr/bin/env python3
import csv
import time
import os
import sys
import logging
from datetime import datetime
from twilio.rest import Client

ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
AUTH_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN", "")
FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")
CSV_FILE    = "top2500_sms_campanha.csv"
LOG_FILE    = f"sms_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
RATE_LIMIT  = 5  # SMS por segundo

MESSAGE_TEMPLATE = (
    "{first_name}, brinde surpresa pra você: compre "
    "qualquer FDC e ganhe Ômega 3 + CoQ10 de presente. "
    "fdcvitaminas.com.br "
    "Sair: https://ysms.me/u/k4DQRfD"
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger(__name__)

if not all([ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER]):
    sys.exit("Erro: defina TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_FROM_NUMBER.")

client = Client(ACCOUNT_SID, AUTH_TOKEN)


def load_contacts(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return [row for row in csv.DictReader(f) if row.get("phone", "").strip()]


def send_campaign(contacts: list[dict]) -> None:
    total = len(contacts)
    delay = 1.0 / RATE_LIMIT
    sent = failed = 0

    log.info(f"Iniciando campanha: {total} contatos a {RATE_LIMIT}/s")

    with open(LOG_FILE, "w", newline="", encoding="utf-8") as logf:
        writer = csv.writer(logf)
        writer.writerow(["index", "phone", "first_name", "status", "sid_or_error"])

        for i, contact in enumerate(contacts, start=1):
            phone      = contact["phone"].strip()
            first_name = contact.get("first_name", "").strip() or "Cliente"
            body       = MESSAGE_TEMPLATE.format(first_name=first_name)

            try:
                msg = client.messages.create(body=body, from_=FROM_NUMBER, to=phone)
                log.info(f"[{i}/{total}] OK  {phone}  sid={msg.sid}")
                writer.writerow([i, phone, first_name, "sent", msg.sid])
                sent += 1
            except Exception as e:
                log.warning(f"[{i}/{total}] ERRO {phone}: {e}")
                writer.writerow([i, phone, first_name, "error", str(e)])
                failed += 1

            if i < total:
                time.sleep(delay)

    log.info(f"Concluído: {sent} enviados, {failed} falhas. Log: {LOG_FILE}")


if __name__ == "__main__":
    contacts = load_contacts(CSV_FILE)
    send_campaign(contacts)
