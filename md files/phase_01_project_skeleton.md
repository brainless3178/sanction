# Phase 1: Project Skeleton & Workspaces

**Objective:** Create the root folder structure and initialize all workspaces to ensure zero friction moving forward.

## Tasks To Complete
1. Initialize a clean monorepo structure inside the root directory.
2. Setup `pnpm` workspaces via a root `package.json`.
3. Create the Rust workspace by adding the root `Cargo.toml`.
4. Initialize `Anchor.toml` configurations for the entire deployment flow.
5. Create `programs/sss-token/` Anchor skeleton structure (`Cargo.toml`, `Xargo.toml`, `src/lib.rs`).
6. Create `programs/transfer-hook/` Anchor skeleton structure (`Cargo.toml`, `src/lib.rs`).
7. Construct the empty `src/state/` and `src/instructions/` module maps in `sss-token`.
8. Create an empty typescript configuration inside `sdk/typescript/` featuring strict `tsconfig.json` and base dependencies.

## Verification
- Running `anchor build` compiles without errors.
- Running `pnpm install` links the workspaces correctly.
