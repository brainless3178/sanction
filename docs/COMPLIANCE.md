# Compliance Guide

## Overview

This guide covers the compliance workflows for SSS-2 stablecoins: blacklisting addresses, seizing funds, screening against sanctions lists, and exporting audit trails.

## Blacklist Management

### Adding to Blacklist

**CLI:**
```bash
sss blacklist-add <ADDRESS> --reason "OFAC match"
```

**SDK:**
```typescript
await stable.compliance.blacklistAdd(targetPubkey, 'OFAC match', authority);
```

**API:**
```bash
curl -X POST http://localhost:3002/api/blacklist/add \
  -H "Content-Type: application/json" \
  -d '{"mintAddress":"...","address":"...","reason":"OFAC match","addedBy":"...","txSignature":"..."}'
```

### Removing from Blacklist

**CLI:**
```bash
sss blacklist-remove <ADDRESS>
```

**SDK:**
```typescript
await stable.compliance.blacklistRemove(targetPubkey, authority);
```

### Checking Blacklist Status

**SDK:**
```typescript
const isBanned = await stable.compliance.isBlacklisted(targetPubkey); // boolean
```

**API:**
```bash
curl "http://localhost:3002/api/blacklist/check?mintAddress=...&address=..."
```

### Listing All Blacklisted Addresses

**SDK:**
```typescript
const entries = await stable.compliance.getBlacklist(); // BlacklistEntry[]
```

**API:**
```bash
curl "http://localhost:3002/api/blacklist?mintAddress=..."
```

## Fund Seizure

### When to Seize

Fund seizure should only be used when:
1. An address is confirmed on a sanctions list (OFAC, EU, etc.)
2. A court order requires asset freezing
3. Internal fraud detection identifies compromised accounts

### Executing Seizure

**CLI (full balance):**
```bash
sss seize --source <ADDRESS> --destination <TREASURY>
```

**SDK (specific amount):**
```typescript
await stable.compliance.seize(
    sourcePublicKey,
    treasuryPublicKey,
    authorityKeypair,
    BigInt(500_000_000) // optional: seize specific amount
);
```

### Seizure Audit

Every seizure emits a `FundsSeized` event containing:
- Source address
- Destination address
- Amount seized
- Authority who executed
- Transaction signature

## Sanctions Screening

### Manual Screening

**API:**
```bash
curl -X POST http://localhost:3002/api/blacklist/screen \
  -H "Content-Type: application/json" \
  -d '{"address":"..."}'
```

Response:
```json
{
    "address": "...",
    "isSanctioned": false,
    "matchType": null,
    "listName": null,
    "matchScore": 0,
    "checkedAt": "2024-01-15T10:00:00Z",
    "details": null
}
```

### External Provider Integration

Configure an external sanctions screening provider:

```env
SANCTIONS_API_URL=https://api.chainalysis.com/v2
SANCTIONS_API_KEY=your-key-here
```

Supported providers (pluggable):
- Chainalysis Sanctions Oracle
- Elliptic
- TRM Labs
- OFAC SDN direct lookup

## Audit Trail Export

### JSON Format (Programmatic)

```bash
curl "http://localhost:3002/api/audit?mintAddress=...&format=json"
```

Response:
```json
{
    "export_generated_at": "2024-01-15T10:00:00Z",
    "mint_address": "...",
    "period": { "from": null, "to": null },
    "total_events": 3,
    "events": [
        {
            "id": "1",
            "type": "blacklist_add",
            "timestamp": "2024-01-10T09:00:00Z",
            "tx_signature": "...",
            "data": { "target_address": "...", "reason": "OFAC match" }
        }
    ]
}
```

### CSV Format (Regulators)

```bash
curl "http://localhost:3002/api/audit?mintAddress=...&format=csv" > audit.csv
```

CSV columns:
```
timestamp,event_type,target_address,executed_by,tx_signature,reason
2024-01-10T09:00:00Z,blacklist_add,<addr>,<admin>,<sig>,OFAC match
```

### Filtering

Filter by event type and date range:
```bash
curl "http://localhost:3002/api/audit?mintAddress=...&eventType=blacklist_add&from=2024-01-01&to=2024-01-31&format=csv"
```

## DB ↔ On-Chain Sync

The blacklist is maintained in two locations:
1. **On-chain** (source of truth): BlacklistEntry PDAs
2. **Off-chain** (PostgreSQL): For fast queries and audit export

Synchronization happens via:
- **Indexer**: Automatically mirrors `AddedToBlacklist` / `RemovedFromBlacklist` events to DB
- **BlacklistSync service**: Periodic full reconciliation comparing on-chain PDAs vs DB records
