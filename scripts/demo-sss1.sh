#!/bin/bash
set -e

echo "═══════════════════════════════════════"
echo "  SSS-1 Demo — Full Lifecycle"
echo "═══════════════════════════════════════"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Verify solana CLI is configured
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $NF}')
echo "Cluster: $CLUSTER"
echo ""

# Step 1: Initialize SSS-1
echo "1. Initializing SSS-1 stablecoin..."
INIT_OUTPUT=$(npx ts-node "$ROOT_DIR/cli/src/index.ts" init \
    --preset sss-1 \
    --name "Demo USD" \
    --symbol "DUSD" \
    --decimals 6 \
    --output json 2>&1)
MINT_ADDRESS=$(echo "$INIT_OUTPUT" | grep -o '"mint":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   Mint: $MINT_ADDRESS"
echo "   ✔ SSS-1 initialized"
echo ""

# Step 2: Add minter
echo "2. Adding minter with 1M quota..."
MINTER_KEYPAIR=$(solana-keygen new --no-bip39-passphrase --silent --outfile /tmp/sss-demo-minter.json 2>&1 && solana address -k /tmp/sss-demo-minter.json)
npx ts-node "$ROOT_DIR/cli/src/index.ts" role assign \
    --mint "$MINT_ADDRESS" \
    --role minter \
    --account "$MINTER_KEYPAIR" \
    --quota 1000000000000
echo "   ✔ Minter added: $MINTER_KEYPAIR"
echo ""

# Step 3: Mint tokens
echo "3. Minting 500,000 tokens..."
RECIPIENT=$(solana address)
npx ts-node "$ROOT_DIR/cli/src/index.ts" mint \
    --mint "$MINT_ADDRESS" \
    --recipient "$RECIPIENT" \
    --amount 500000000000 \
    --minter /tmp/sss-demo-minter.json
echo "   ✔ Minted 500,000 tokens"
echo ""

# Step 4: Check supply
echo "4. Checking supply..."
spl-token supply "$MINT_ADDRESS" --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
echo ""

# Step 5: Burn tokens
echo "5. Burning 100,000 tokens..."
npx ts-node "$ROOT_DIR/cli/src/index.ts" burn \
    --mint "$MINT_ADDRESS" \
    --amount 100000000000
echo "   ✔ Burned 100,000 tokens"
echo ""

# Step 6: Freeze and thaw
echo "6. Testing freeze/thaw..."
npx ts-node "$ROOT_DIR/cli/src/index.ts" freeze \
    --mint "$MINT_ADDRESS" \
    --account "$RECIPIENT"
echo "   Frozen"
npx ts-node "$ROOT_DIR/cli/src/index.ts" thaw \
    --mint "$MINT_ADDRESS" \
    --account "$RECIPIENT"
echo "   Thawed"
echo "   ✔ Freeze/thaw verified"
echo ""

echo "═══════════════════════════════════════"
echo "  SSS-1 Demo — COMPLETE"
echo "═══════════════════════════════════════"
echo ""
echo "Mint Address: $MINT_ADDRESS"

# Cleanup
rm -f /tmp/sss-demo-minter.json
