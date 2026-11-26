# API reference

Base URL (local): `http://localhost:3001/api/v1`  
Interactive OpenAPI: `http://localhost:3001/api/docs`

All organization-scoped routes require:

```http
Authorization: Bearer <accessToken>
x-organization-id: <organizationUuid>
```

(The org id also appears in the path as `:orgId`.)

---

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | Public | Create user; returns `{ accessToken, user }` |
| `POST` | `/auth/login` | Public | Login; returns `{ accessToken, user }` |
| `POST` | `/auth/logout` | Optional | Client-side clear; returns `{ ok: true }` |
| `GET` | `/auth/me` | JWT | Profile + memberships / organizations |

**Register body:** `{ email, password, fullName }`  
**Login body:** `{ email, password }`

---

## Organizations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/organizations` | JWT | Create org; caller becomes admin |
| `GET` | `/organizations/:orgId` | Member | Org + treasury config |
| `PATCH` | `/organizations/:orgId` | `org:manage` | Update legal metadata |
| `GET` | `/organizations/:orgId/members` | Member | List members |
| `POST` | `/organizations/:orgId/members` | `members:manage` | Invite / upsert member role |

**Create body:** `{ legalName, country?, businessEmail?, registrationNumber? }`

---

## Suppliers

Prefix: `/organizations/:orgId/suppliers`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/` | `suppliers:manage` | Create supplier |
| `GET` | `/` | Member* | List |
| `GET` | `/:id` | Member* | Get |
| `POST` | `/:id/payment-destinations` | `suppliers:manage` | Add destination |
| `POST` | `/:id/payment-destinations/:destId/approve` | `suppliers:manage` | Approve destination |

\*Read access enforced by membership; write by permission.

Destination fields include `chainId`, `tokenAddress`, `walletAddress`.

---

## Invoices & purchase orders

Prefix: `/organizations/:orgId/invoices`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/` | `invoices:write` | Create invoice |
| `GET` | `/` | Member | List |
| `GET` | `/:id` | Member | Get |
| `POST` | `/:id/upload` | `invoices:write` | Upload document |
| `POST` | `/:id/extract` | `invoices:write` | Run extraction |
| `POST` | `/:id/verify` | `invoices:review` | Mark verified |
| `POST` | `/:id/...` | varies | Additional lifecycle actions |

Purchase orders: `/organizations/:orgId/purchase-orders` (`invoices:write` to create).

---

## Approvals

Prefix: `/organizations/:orgId/approvals`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/` | Member | List requests |
| `POST` | `/policies` | `policies:manage` | Configure approval policy |
| `POST` | `/submit/:invoiceId` | `invoices:review` | Start approval |
| `POST` | `/:id/approve` | `approvals:decide` | Approve |
| `POST` | `/:id/reject` | `approvals:decide` | Reject |

---

## Payment policies

Prefix: `/organizations/:orgId/policies`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/` | `policies:manage` | Publish policy version |
| `GET` | `/` | Member | List |
| `GET` | `/:id` | Member | Get |
| `POST` | `/evaluate/:paymentId` | `payments:execute` | Evaluate (also used internally) |

**Create body (representative):**

```json
{
  "policyName": "Default spend",
  "perPaymentLimitMinor": "25000000000",
  "dailySpendLimitMinor": "100000000000",
  "processorAddress": "0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF",
  "circuitId": "1"
}
```

Minor units: USDC has **6 decimals** (e.g. `1000000` = 1 USDC).

---

## Payments

Prefix: `/organizations/:orgId/payments`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/network` | Member | Chain, USDC, TapeOut, settlement mode |
| `POST` | `/` | `payments:execute` | Create payment (`invoiceId`, `idempotencyKey`) |
| `GET` | `/` | Member | List |
| `GET` | `/:id` | Member | Get |
| `POST` | `/:id/authorize` | `payments:execute` | Policy + TapeOut → `AUTHORIZED` |
| `POST` | `/:id/execute` | `payments:execute` | Settlement submit |
| `GET` | `/:id/status` | Member | Refresh confirmations |
| `POST` | `/:id/reconcile` | `payments:execute` | Mark completed path |

**Authorize response** includes `evaluation.tapeOut` (`mode`, `processor`, `circuitId`, `inputs`, `rawOutput`, `pass`, `chainId`).

**Network response** includes `settlementMode`, `tapeOut`, `contracts`, `explorerTxBase`.

---

## Reconciliation, ERP, audit

| Area | Prefix | Key permission |
|------|--------|----------------|
| Reconciliation | `/organizations/:orgId/reconciliation` | `payments:execute` to run |
| ERP | `/organizations/:orgId/erp` | `erp:manage` |
| Audit | `/organizations/:orgId/audit` | `audit:read` |

---

## Health

`GET /health` — liveness for orchestration.

---

## Error shape

Failed requests return JSON with `message` / Nest validation flatten. Policy rejection may embed evaluation `output` for debugging.

## Client helper

The web app uses [`apps/web/src/lib/api.ts`](../apps/web/src/lib/api.ts): attaches JWT + org header, parses JSON errors.
