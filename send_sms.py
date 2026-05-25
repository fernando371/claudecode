#!/usr/bin/env python3
import csv
import time
import os
import sys
from twilio.rest import Client

# --- Configuração ---
ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
AUTH_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN", "")
FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")  # ex: +15551234567
CSV_FILE    = "inscritos_sms_limpos.csv"
PHONE_COL   = "phone"  # nome da coluna com o número no CSV
MESSAGE     = "Compras acima de R$300 no site FDC ganham Omega + CoQ10 de brinde + frete grátis! Aproveite: [SEU_LINK]"
RATE_LIMIT  = 5  # envios por segundo

# --- Validação ---
if not all([ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER]):
    sys.exit("Erro: defina TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_FROM_NUMBER como variáveis de ambiente.")

client = Client(ACCOUNT_SID, AUTH_TOKEN)

def load_numbers(path: str, col: str) -> list[str]:
    numbers = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if col not in (reader.fieldnames or []):
            available = reader.fieldnames
            sys.exit(f"Coluna '{col}' não encontrada. Colunas disponíveis: {available}")
        for row in reader:
            num = row[col].strip()
            if num:
                numbers.append(num)
    return numbers

def send_sms(numbers: list[str]) -> None:
    total   = len(numbers)
    sent    = 0
    failed  = 0
    delay   = 1.0 / RATE_LIMIT  # segundos entre envios

    print(f"Enviando para {total} números (rate limit: {RATE_LIMIT}/s)...")

    for i, number in enumerate(numbers, start=1):
        try:
            msg = client.messages.create(
                body=MESSAGE,
                from_=FROM_NUMBER,
                to=number,
            )
            print(f"[{i}/{total}] OK  {number}  sid={msg.sid}")
            sent += 1
        except Exception as e:
            print(f"[{i}/{total}] ERRO {number}: {e}")
            failed += 1

        # rate limiting: espera após cada envio exceto o último
        if i < total:
            time.sleep(delay)

    print(f"\nConcluído: {sent} enviados, {failed} falhas.")

if __name__ == "__main__":
    numbers = load_numbers(CSV_FILE, PHONE_COL)
    send_sms(numbers)
