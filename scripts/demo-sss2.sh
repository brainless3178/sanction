#!/bin/bash
set -e

echo "═══════════════════════════════════════════"
echo "  SSS-2 Demo — Compliance Lifecycle"
echo "═══════════════════════════════════════════"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CLI="npx ts-node $ROOT_DIR/cli/src/index.ts"

CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $NF}')
echo "Cluster: $CLUSTER"
echo ""

# Step 1: Initialize SSS-2
echo "1. Initializing SSS-2 stablecoin (TUSD)..."
INIT_OUTPUT=$($CLI init \
    --preset sss-2 \
    --name "Test USD" \
    --symbol "TUSD" \
    --decimals 6 \
    --output json 2>&1)
MINT_ADDRESS=$(echo "$INIT_OUTPUT" | grep -o '"mint":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   Mint: $MINT_ADDRESS"
echo "   ✔ SSS-2 deployed"
echo ""

# Step 2: Add minter
echo "2. Adding minter with 1M quota..."
solana-keygen new --no-bip39-passphrase --silent --outfile /tmp/sss-demo-minter.json 2>/dev/null || true
MINTER_ADDR=$(solana address -k /tmp/sss-demo-minter.json)
$CLI role assign \
    --mint "$MINT_ADDRESS" \
    --role minter \
    --account "$MINTER_ADDR" \
    --quota 1000000000000
echo "   ✔ Minter: $MINTER_ADDR"
echo ""

# Step 3: Create wallet A
echo "3. Minting 500K tokens to wallet A..."
solana-keygen new --no-bip39-passphrase --silent --outfile /tmp/sss-wallet-a.json 2>/dev/null || true
WALLET_A=$(solana address -k /tmp/sss-wallet-a.json)
solana airdrop 1 "$WALLET_A" 2>/dev/null || true
$CLI mint \
    --mint "$MINT_ADDRESS" \
    --recipient "$WALLET_A" \
    --amount 500000000000 \
    --minter /tmp/sss-demo-minter.json
echo "   ✔ Minted to $WALLET_A"
echo ""

# Step 4: Blacklist wallet A
echo "4. Blacklisting wallet A (reason: 'Demo OFAC match')..."
$CLI blacklist add \
    --mint "$MINT_ADDRESS" \
    --address "$WALLET_A" \
    --reason "Demo OFAC match"
echo "   ✔ Wallet A blacklisted"
echo ""

# Step 5: Attempt transfer from A (should fail)
echo "5. Attempting transfer from blacklisted wallet A..."
if $CLI transfer \
    --mint "$MINT_ADDRESS" \
    --from /tmp/sss-wallet-a.json \
    --to "$(solana address)" \
    --amount 1000000 2>&1; then
    echo "   ✗ ERROR: Transfer should have been blocked!"
    exit 1
else
    echo "   ✔ Transfer correctly blocked by transfer hook"
fi
echo ""

# Step 6: Seize funds
echo "6. Seizing all funds from wallet A to treasury..."
TREASURY=$(solana address)
$CLI seize \
    --mint "$MINT_ADDRESS" \
    --from "$WALLET_A" \
    --to "$TREASURY"
echo "   ✔ Funds seized to treasury"
echo ""

# Step 7: Remove from blacklist
echo "7. Removing wallet A from blacklist..."
$CLI blacklist remove \
    --mint "$MINT_ADDRESS" \
    --address "$WALLET_A"
echo "   ✔ Wallet A unblacklisted"
echo ""

# Step 8: Print results
echo "═══════════════════════════════════════════"
echo "  SSS-2 Demo — COMPLETE"
echo "═══════════════════════════════════════════"
echo ""
echo "Mint:     $MINT_ADDRESS"
echo "Minter:   $MINTER_ADDR"
echo "Wallet A: $WALLET_A"
echo "Treasury: $TREASURY"

# Save to deployments
DEPLOY_FILE="$ROOT_DIR/deployments/devnet.json"
cat > "$DEPLOY_FILE" <<EOF
{
    "cluster": "$CLUSTER",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "programs": {
        "sss_token": "$(grep 'sss_token' "$ROOT_DIR/Anchor.toml" | head -1 | cut -d'"' -f2)",
        "transfer_hook": "$(grep 'transfer_hook' "$ROOT_DIR/Anchor.toml" | head -1 | cut -d'"' -f2)"
    },
    "demo": {
        "mint": "$MINT_ADDRESS",
        "minter": "$MINTER_ADDR",
        "walletA": "$WALLET_A",
        "treasury": "$TREASURY"
    }
}
EOF
echo ""
echo "Results saved to: $DEPLOY_FILE"

# Cleanup
rm -f /tmp/sss-demo-minter.json /tmp/sss-wallet-a.json
