#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "============================================"
echo "  SSS Token — Devnet Deployment Script"
echo "============================================"
echo ""

# 1. Build all programs
echo "Building programs..."
anchor build

# 2. Deploy sss-token
echo ""
echo "Deploying sss-token program..."
SSS_TOKEN_ID=$(solana program deploy target/deploy/sss_token.so --output json | jq -r '.programId')
echo "  ✔ sss-token: $SSS_TOKEN_ID"

# 3. Deploy transfer-hook
echo ""
echo "Deploying transfer-hook program..."
HOOK_ID=$(solana program deploy target/deploy/transfer_hook.so --output json | jq -r '.programId')
echo "  ✔ transfer-hook: $HOOK_ID"

# 4. Deploy oracle-module
echo ""
echo "Deploying oracle-module program..."
ORACLE_ID=$(solana program deploy target/deploy/oracle_module.so --output json | jq -r '.programId')
echo "  ✔ oracle-module: $ORACLE_ID"

# 5. Deploy sss-private
echo ""
echo "Deploying sss-private program..."
PRIVATE_ID=$(solana program deploy target/deploy/sss_private.so --output json | jq -r '.programId')
echo "  ✔ sss-private: $PRIVATE_ID"

# 6. Update Anchor.toml with deployed IDs
echo ""
echo "Updating Anchor.toml..."
sed -i "s/sss_token = \".*\"/sss_token = \"$SSS_TOKEN_ID\"/" Anchor.toml
sed -i "s/transfer_hook = \".*\"/transfer_hook = \"$HOOK_ID\"/" Anchor.toml
sed -i "s/oracle_module = \".*\"/oracle_module = \"$ORACLE_ID\"/" Anchor.toml
sed -i "s/sss_private = \".*\"/sss_private = \"$PRIVATE_ID\"/" Anchor.toml

# 7. Save deployment info
echo ""
echo "Saving deployment info to deployments/devnet.json..."
mkdir -p deployments
cat > deployments/devnet.json <<EOF
{
    "cluster": "devnet",
    "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "programs": {
        "sssToken": "$SSS_TOKEN_ID",
        "transferHook": "$HOOK_ID",
        "oracleModule": "$ORACLE_ID",
        "sssPrivate": "$PRIVATE_ID"
    },
    "demos": {}
}
EOF

# 8. Run SSS-2 demo (populates demos section of devnet.json)
echo ""
echo "Running SSS-2 demo..."
PROGRAM_ID="$SSS_TOKEN_ID" HOOK_PROGRAM_ID="$HOOK_ID" \
    npx ts-node "$SCRIPT_DIR/demo-sss2.ts"

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "  Programs deployed:"
echo "    sss-token:     $SSS_TOKEN_ID"
echo "    transfer-hook: $HOOK_ID"
echo "    oracle-module: $ORACLE_ID"
echo "    sss-private:   $PRIVATE_ID"
echo ""
echo "  See deployments/devnet.json for details."
echo "============================================"
