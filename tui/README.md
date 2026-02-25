# Sanction Terminal UI (TUI)

The **Sanction TUI** is a terminal-based dashboard designed for developers and server administrators who want real-time monitoring of their stablecoin deployments without leaving their CLI environment.

Built using [Ink](https://github.com/vadimdemedes/ink), it brings the power of React components to the terminal, delivering a visually appealing and responsive command-line interface.

## Key Features

- **Live On-Chain Feeds**: Streams recent transactions and Anchor events directly into the terminal window.
- **Supply Metrics Dashboard**: Instantly view Circulating Supply, Total Minted, and Total Burned statistics.
- **Role Overview**: Quickly check assigned roles and remaining minter quotas in a terminal grid.
- **Resource Efficient**: Perfect for SSH sessions or running alongside logs on a server.

## Installation & Setup

```bash
cd tui
pnpm install
```

Ensure your environment has access to your Solana configuraton:

```bash
export RPC_URL="https://api.devnet.solana.com"
export PROGRAM_ID="2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no"
export MINT_ADDRESS="<YOUR_DEPLOYED_MINT_ADDRESS>"
```

## Running the TUI

To launch the dashboard, use:

```bash
pnpm dev
# or
pnpm start
```

Press `q` or `Ctrl+C` at any time to softly exit the TUI.

## Under the Hood

The TUI utilizes the same underlying TypeScript SDK as the web frontend, ensuring 100% parity in data fetching logic. It listens to Solana WebSocket subscriptions (`onLogs`) to render real-time UI updates in the terminal shell.
