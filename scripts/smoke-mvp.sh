#!/usr/bin/env bash
# MVP acceptance smoke: invoice → approve → authorize → settle → reconcile → audit
set -euo pipefail
API="${API_URL:-http://localhost:3001/api/v1}"
if [ -z "${DEMO_SEED_PASSWORD:-}" ]; then
  echo "Set DEMO_SEED_PASSWORD to the same value used for db:seed" >&2
  exit 1
fi

TOKEN=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "$(DEMO_SEED_PASSWORD="$DEMO_SEED_PASSWORD" python3 -c 'import json,os; print(json.dumps({"email":"admin@avenza.demo","password":os.environ["DEMO_SEED_PASSWORD"]}))')" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])')
ORG=$(curl -s "$API/auth/me" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["organizations"][0]["id"])')
AUTH=(-H "Authorization: Bearer $TOKEN" -H "x-organization-id: $ORG")

SUP=$(curl -s "$API/organizations/$ORG/suppliers" "${AUTH[@]}")
SID=$(echo "$SUP" | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')
DID=$(echo "$SUP" | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["paymentDestinations"][0]["id"])')

INV_NO="INV-SMOKE-$(date +%s)"
INV=$(curl -s -X POST "$API/organizations/$ORG/invoices" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"supplierId\":\"$SID\",\"invoiceNumber\":\"$INV_NO\"}")
IID=$(echo "$INV" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

printf "Invoice number %s\nFrom: Lagos Components Supply\nTotal: \$50.00\nUSDC\n" "$INV_NO" >/tmp/avenza-inv.txt
curl -s -X POST "$API/organizations/$ORG/invoices/$IID/upload" "${AUTH[@]}" -F "file=@/tmp/avenza-inv.txt" >/dev/null
curl -s -X POST "$API/organizations/$ORG/invoices/$IID/extract" "${AUTH[@]}" >/dev/null
curl -s -X POST "$API/organizations/$ORG/invoices/$IID/review" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"invoiceNumber\":\"$INV_NO\",\"supplierId\":\"$SID\",\"invoiceDate\":\"2026-11-23\",\"currency\":\"USDC\",\"subtotal\":\"50\",\"taxAmount\":\"0\",\"totalAmount\":\"50\",\"paymentDestinationId\":\"$DID\"}" >/dev/null
curl -s -X POST "$API/organizations/$ORG/invoices/$IID/verify" "${AUTH[@]}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["invoice"]["status"]=="VERIFIED", d'

AID=$(curl -s -X POST "$API/organizations/$ORG/approvals/submit/$IID" "${AUTH[@]}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
curl -s -X POST "$API/organizations/$ORG/approvals/$AID/approve" "${AUTH[@]}" -H 'Content-Type: application/json' -d '{}' >/dev/null

PID=$(curl -s -X POST "$API/organizations/$ORG/payments" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"invoiceId\":\"$IID\",\"idempotencyKey\":\"smoke-$IID\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
curl -s -X POST "$API/organizations/$ORG/payments/$PID/authorize" "${AUTH[@]}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["payment"]["status"]=="AUTHORIZED"'
curl -s -X POST "$API/organizations/$ORG/payments/$PID/execute" "${AUTH[@]}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["transactionHash"], d'
for _ in 1 2 3 4 5; do
  STATUS=$(curl -s "$API/organizations/$ORG/payments/$PID/status" "${AUTH[@]}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("status",""))')
  [[ "$STATUS" == "PAYMENT_CONFIRMED" ]] && break
  sleep 1
done
curl -s "$API/organizations/$ORG/payments/$PID/status" "${AUTH[@]}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["status"] in ("PAYMENT_CONFIRMED","PAYMENT_SUBMITTED"), d'
# Confirm before reconcile when still submitted (RPC lag on live txs)
if [[ "$STATUS" != "PAYMENT_CONFIRMED" ]]; then
  sleep 2
  STATUS=$(curl -s "$API/organizations/$ORG/payments/$PID/status" "${AUTH[@]}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
fi
curl -s -X POST "$API/organizations/$ORG/payments/$PID/reconcile" "${AUTH[@]}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("status")=="COMPLETED", d'

echo "MVP smoke OK org=$ORG invoice=$IID payment=$PID"
