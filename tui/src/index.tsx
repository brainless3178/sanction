#!/usr/bin/env node
import React, { useState, useCallback, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { Connection, PublicKey } from '@solana/web3.js';
import { useSupply } from './hooks/useSupply';
import { useEvents } from './hooks/useEvents';
import { SupplyPanel } from './components/SupplyPanel';
import { EventsPanel } from './components/EventsPanel';
import { MintersPanel } from './components/MintersPanel';
import { MintScreen, BlacklistScreen, SeizeScreen } from './screens/Operations';

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const MINT_ADDRESS = process.env.MINT_ADDRESS || '';
const PROGRAM_ID = process.env.PROGRAM_ID || '';

type Screen = 'dashboard' | 'mint' | 'blacklist' | 'seize';

// Reads RoleAssignment PDAs where roleType=0 (Minter) and computes quota % used.
async function fetchMinters(
    connection: Connection,
    programId: string,
): Promise<Array<{ address: string; quotaUsed: number }>> {
    try {
        const pid = new PublicKey(programId);
        const accounts = await connection.getProgramAccounts(pid);

        const minters: Array<{ address: string; quotaUsed: number }> = [];

        for (const { account } of accounts) {
            const data = account.data;
            // RoleAssignment: discriminator(8) + mint(32) + account(32) + roleType(1) + limit(8) + mintedThisPeriod(8) + periodStart(8)
            if (data.length < 8 + 32 + 32 + 1 + 8 + 8 + 8) continue;

            const roleType = data[8 + 32 + 32];
            if (roleType !== 0) continue; // 0 = Minter

            const assignee = new PublicKey(data.subarray(8 + 32, 8 + 64));
            const limit = Number(data.readBigUInt64LE(8 + 64 + 1));
            const used = Number(data.readBigUInt64LE(8 + 64 + 1 + 8));
            const quotaUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;

            minters.push({
                address: assignee.toBase58().slice(0, 8) + '...' + assignee.toBase58().slice(-4),
                quotaUsed,
            });
        }

        return minters;
    } catch {
        return [];
    }
}

const App: React.FC = () => {
    const { exit } = useApp();
    const [screen, setScreen] = useState<Screen>('dashboard');
    const [statusMessage, setStatusMessage] = useState('');
    const [minters, setMinters] = useState<Array<{ address: string; quotaUsed: number }>>([]);

    const connection = new Connection(RPC_URL, 'confirmed');
    const supply = useSupply(connection, MINT_ADDRESS);
    const events = useEvents(connection, PROGRAM_ID);

    // Fetch minters from on-chain data
    useEffect(() => {
        if (!PROGRAM_ID) return;
        const load = async () => {
            const data = await fetchMinters(connection, PROGRAM_ID);
            setMinters(data);
        };
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = useCallback((action: string, params: Record<string, string>) => {
        setStatusMessage(`✔ ${action} submitted: ${JSON.stringify(params)}`);
        setTimeout(() => setStatusMessage(''), 5000);
    }, []);

    useInput((input: string, key: any) => {
        if (screen !== 'dashboard') return;

        switch (input.toLowerCase()) {
            case 'm': setScreen('mint'); break;
            case 'b': setScreen('blacklist'); break;
            case 's': setScreen('seize'); break;
            case 'q': exit(); break;
            case 'p':
                setStatusMessage('⏸  Pause toggled');
                setTimeout(() => setStatusMessage(''), 3000);
                break;
        }
    });

    if (screen === 'mint') {
        return <MintScreen onBack={() => setScreen('dashboard')} onSubmit={handleSubmit} />;
    }
    if (screen === 'blacklist') {
        return <BlacklistScreen onBack={() => setScreen('dashboard')} onSubmit={handleSubmit} />;
    }
    if (screen === 'seize') {
        return <SeizeScreen onBack={() => setScreen('dashboard')} onSubmit={handleSubmit} />;
    }

    return (
        <Box flexDirection="column">
            {/* Header */}
            <Box borderStyle="doubleSingle" paddingX={1} justifyContent="space-between">
                <Text bold color="cyan">SSS-TOKEN DASHBOARD</Text>
                <Text color="yellow">{MINT_ADDRESS ? MINT_ADDRESS.slice(0, 8) + '...' : 'No mint set'}</Text>
                <Text dimColor>Devnet</Text>
                <Text color="red">[P] PAUSE</Text>
            </Box>

            {/* Main Panels */}
            <Box flexDirection="row">
                <SupplyPanel supply={supply} />
                <MintersPanel minters={minters} />
                <EventsPanel events={events} />
            </Box>

            {/* Status Message */}
            {statusMessage && (
                <Box paddingX={1}>
                    <Text color="green">{statusMessage}</Text>
                </Box>
            )}

            {/* Hotkey Bar */}
            <Box borderStyle="single" paddingX={1} justifyContent="space-around">
                <Text>[<Text color="green" bold>M</Text>] MINT</Text>
                <Text>[<Text color="blue" bold>F</Text>] FREEZE</Text>
                <Text>[<Text color="red" bold>B</Text>] BLACKLIST</Text>
                <Text>[<Text color="magenta" bold>S</Text>] SEIZE</Text>
                <Text>[<Text color="gray" bold>Q</Text>] QUIT</Text>
            </Box>
        </Box>
    );
};

render(<App />);
