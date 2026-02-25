# SSS-Token Fuzz Testing — Trident Configuration

## Overview

This directory contains fuzz test targets for the `sss-token` program using
[Trident](https://github.com/Ackee-Blockchain/trident), the Solana fuzzing framework.

Fuzz tests automatically discover edge cases including:
- Integer overflow/underflow in amount calculations
- Invalid PDA derivations
- Unauthorized access to protected instructions
- Edge cases in quota period resets
- Boundary conditions on name/symbol/URI length limits

## Setup

```bash
# Install Trident
cargo install trident-cli

# Initialize fuzz targets
trident init
```

## Fuzz Targets

### 1. Mint Amount Overflow
Tests that `checked_add` prevents overflow in `total_minted` and `minted_this_period`.

### 2. Quota Boundary
Tests quota enforcement at exact boundaries (quota - 1, quota, quota + 1).

### 3. String Length Validation
Tests name/symbol/URI validation at max length boundaries.

### 4. Role Authorization
Tests that incorrect role types are rejected for each instruction.

### 5. Seize Amount Edge Cases
Tests partial seize with amount == balance, amount > balance, amount == 0.
