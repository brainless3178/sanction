# Sanction CLI

The **Sanction CLI** is a powerful command-line interface for deploying, managing, and interacting with Solana Stablecoin Standard (SSS) tokens. It is built for protocol operators, compliance officers, and treasury managers who need direct, scriptable access to on-chain operations.

## Features

- **Deployment**: Deploy new SSS-1 or SSS-2 stablecoins directly from the terminal.
- **Treasury Management**: Issue `mint` and `burn` commands.
- **Role Administration**: Assign or revoke `Minter`, `Burner`, `Blacklister`, `Pauser`, and `Seizer` roles.
- **Compliance Operations (SSS-2)**: Add or remove addresses from the on-chain blacklist, and execute funds seizures.
- **Global Constraints**: Freeze specific token accounts or trigger a global pause.

## Installation

Ensure you have Node.js (>= 18) installed. From the project root, navigate to the CLI directory:

```bash
cd cli
pnpm install
pnpm build
```

You can run the CLI directly using the `dev` script:

```bash
pnpm start --help
```

Or link it globally (optional):

```bash
npm link
sanction-cli --help
```

## Configuration

The CLI relies on standard Solana environment configurations. By default, it will attempt to use your local `~/.config/solana/id.json` and the currently configured RPC URL. 

You can override these using environment variables:

```bash
export RPC_URL="https://api.devnet.solana.com"
export KEYPAIR_PATH="/path/to/your/keypair.json"
export PROGRAM_ID="2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no"
```

## Common Commands

### Deploy a New Stablecoin
Deploys a new SSS-2 (Full Compliance) stablecoin:

```bash
pnpm start create --preset SSS_2 --name "Sanction USD" --symbol "SUSD" --decimals 6
```

### Minting Tokens
Mint 1,000,000 tokens to a target address:

```bash
pnpm start mint --mint <MINT_ADDRESS> --to <RECIPIENT_ADDRESS> --amount 1000000
```

### Managing Roles
Assign a `Minter` role with a specific quota:

```bash
pnpm start assign-role --mint <MINT_ADDRESS> --account <MINTER_PUBKEY> --role Minter --quota 50000000
```

### Applying Sanctions (Blacklisting)
Blacklist a malicious actor, preventing them from transferring tokens:

```bash
pnpm start blacklist --add <TARGET_PUBKEY> --mint <MINT_ADDRESS> --reason "OFAC Specially Designated National"
```

### Seizing Funds
Seize funds from a sanctioned account and route them to a treasury wallet:

```bash
pnpm start seize --mint <MINT_ADDRESS> --from <TARGET_PUBKEY> --to <TREASURY_PUBKEY>
```

## Security & Access Control

Operations require the caller to hold the appropriate on-chain Role PDA (e.g., you must have the `Minter` role to execute a mint, or `Blacklister` role to sanction an account). Attempting to execute unauthorized commands will result in an Anchor `ConstraintRaw` or `Unauthorized` error.
