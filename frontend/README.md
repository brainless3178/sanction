# Sanction Dashboard (Frontend UI)

The **Sanction Dashboard** is a premium, professional web interface for managing Solana Stablecoin Standard (SSS) deployments. It provides operators with clear, visual oversight over token supply, active roles, real-time transaction logs, and compliance enforcement.

## Features

- **Real-Time Analytics**: Monitor circulating supply, total minted, and total burned metrics in real time.
- **Role Management UI**: Visually assign, update, and revoke roles (`Minter`, `Burner`, `Blacklister`, etc.) and monitor minter quotas.
- **Compliance Center**: Interface for viewing the current blacklist, adding new sanctioned addresses, and auditing the reasons for their inclusion.
- **Global Control Panel**: One-click toggles for pausing the stablecoin network or freezing specific accounts in emergencies.
- **WebSocket Streaming**: Live event feeds tracking on-chain Anchor events (e.g., `TokensMinted`, `AddedToBlacklist`, `FundsSeized`).

## Tech Stack

- **Framework**: React 18 + Vite
- **Styling**: TailwindCSS (or Vanilla CSS with rich, modern design aesthetics, glassmorphism, and dark mode optimizations)
- **Solana Integration**: `@solana/web3.js`, `@solana/wallet-adapter-react`, and `@coral-xyz/anchor`
- **SDK**: Pre-configured integration with the internal Sanction TypeScript SDK.

## Getting Started

### Prerequisites

Ensure you have Node.js and PNPM installed.

### Installation

```bash
cd frontend
pnpm install
```

### Environment Configuration

Create a `.env` file in the `frontend` directory:

```env
VITE_RPC_URL=https://api.devnet.solana.com
VITE_PROGRAM_ID=2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no
VITE_COMPLIANCE_API=http://localhost:3002
```

### Running Locally

Start the Vite development server:

```bash
pnpm run dev
```

The application will be available at `http://localhost:5173`.

### Building for Production

To create an optimized production build:

```bash
pnpm run build
```

This will output the compiled static assets into the `dist` directory, ready to be served by Nginx, Vercel, or any static file host.

## Design Philosophy

The Sanction Dashboard is built not just for functionality, but to provide a "WOW" factor. We prioritize visual excellence, utilizing sleek dark themes, modern typography (Inter/Outfit), subtle gradients, and micro-animations to ensure compliance management feels like a cutting-edge financial experience rather than a mundane chore.
