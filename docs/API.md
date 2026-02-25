# API Reference

## Mint Service (Port 3001)

### Health Check

```
GET /health
```

Response:
```json
{ "status": "ok", "service": "mint-service", "timestamp": "2024-01-15T10:00:00Z" }
```

### Create Mint Request

```
POST /api/mint
```

Headers:
- `Content-Type: application/json`
- `X-API-Key: <api-key>` (if configured)

Body:
```json
{
    "mintAddress": "So1ana111...",
    "recipient": "Rec1pient...",
    "amount": "1000000000"
}
```

Response (202 Accepted):
```json
{
    "id": "uuid-here",
    "status": "pending",
    "message": "Mint request accepted and processing"
}
```

Errors:
- `400` — Validation error
- `429` — Quota exceeded
- `500` — Internal error

### Get Mint Request Status

```
GET /api/mint/:id
```

Response:
```json
{
    "id": "uuid-here",
    "mintAddress": "So1ana111...",
    "recipient": "Rec1pient...",
    "amount": "1000000000",
    "status": "executed",
    "txSignature": "5abc...",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:05Z"
}
```

Status values: `pending` → `verified` → `executed` | `failed`

### List Mint Requests

```
GET /api/mint?status=pending
```

Response:
```json
{
    "data": [{ "id": "...", "status": "pending", ... }],
    "count": 5
}
```

---

## Compliance Service (Port 3002)

### Health Check

```
GET /health
```

### Add to Blacklist

```
POST /api/blacklist/add
```

Body:
```json
{
    "mintAddress": "So1ana111...",
    "address": "BadActor...",
    "reason": "OFAC match",
    "addedBy": "Authority...",
    "txSignature": "5abc..."
}
```

Response (201 Created):
```json
{
    "status": "added",
    "record": {
        "id": "1",
        "address": "BadActor...",
        "reason": "OFAC match",
        "addedBy": "Authority...",
        "txSignature": "5abc...",
        "addedAt": "2024-01-15T10:00:00Z"
    }
}
```

### Remove from Blacklist

```
POST /api/blacklist/remove
```

Body:
```json
{
    "mintAddress": "So1ana111...",
    "address": "BadActor...",
    "removedTx": "5def..."
}
```

### List Blacklisted Addresses

```
GET /api/blacklist?mintAddress=So1ana111...
```

Response:
```json
{
    "mintAddress": "So1ana111...",
    "count": 2,
    "data": [
        { "address": "...", "reason": "OFAC match", "addedBy": "...", "addedAt": "..." }
    ]
}
```

### Check Blacklist Status

```
GET /api/blacklist/check?mintAddress=So1ana111...&address=BadActor...
```

Response:
```json
{
    "mintAddress": "So1ana111...",
    "address": "BadActor...",
    "isBlacklisted": true
}
```

### Screen Address (Sanctions)

```
POST /api/blacklist/screen
```

Body:
```json
{ "address": "SomeAddr..." }
```

Response:
```json
{
    "address": "SomeAddr...",
    "isSanctioned": false,
    "matchType": null,
    "listName": null,
    "matchScore": 0,
    "checkedAt": "2024-01-15T10:00:00Z",
    "details": null
}
```

### Export Audit Trail

```
GET /api/audit?mintAddress=So1ana111...&format=json
GET /api/audit?mintAddress=So1ana111...&format=csv
```

Query parameters:
| Param | Required | Description |
|-------|----------|-------------|
| `mintAddress` | ✅ | Stablecoin mint address |
| `format` | ❌ | `json` (default) or `csv` |
| `eventType` | ❌ | Filter by event type |
| `from` | ❌ | Start date (ISO 8601) |
| `to` | ❌ | End date (ISO 8601) |
| `limit` | ❌ | Max results (default: 100) |
| `offset` | ❌ | Pagination offset |

---

## Webhook Payload

When events are dispatched via webhooks:

```
POST <webhook-url>

Headers:
  Content-Type: application/json
  X-SSS-Signature: <hmac-sha256-hex>
  X-SSS-Event: <event-type>

Body:
{
    "id": "1",
    "event_type": "AddedToBlacklist",
    "mint_address": "So1ana111...",
    "data": { ... },
    "tx_signature": "5abc...",
    "slot": 123456,
    "timestamp": "2024-01-15T10:00:00Z"
}
```

### Verifying Webhook Signatures

```typescript
import crypto from 'crypto';

const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

if (signature === request.headers['x-sss-signature']) {
    // Valid webhook
}
```

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| All endpoints | 100 requests/minute per IP |

Exceeded limit returns `429 Too Many Requests`.

## Authentication

Set `API_KEY` environment variable. Requests must include `X-API-Key` header.

If `API_KEY` is not set, authentication is bypassed (development mode only).
