import React, { useState } from 'react';
import { createStablecoin } from '../../lib/sdk';

const PRESETS = [
    {
        id: 'SSS_1' as const,
        name: 'SANCTION-1 Minimal',
        description: 'Basic stablecoin with mint, burn, freeze, and pause.',
        features: ['MetadataPointer', 'MintCloseAuthority', 'Role-based access', 'Daily quotas'],
        color: 'from-blue-500 to-cyan-500',
    },
    {
        id: 'SSS_2' as const,
        name: 'SANCTION-2 Compliant',
        description: 'Full compliance suite with blacklist, seize, and transfer hook.',
        features: ['Everything in SANCTION-1', 'PermanentDelegate', 'TransferHook', 'Blacklist + Seize', 'Audit trail'],
        color: 'from-purple-500 to-pink-500',
    },
];

export const CreatePage: React.FC = () => {
    const [selectedPreset, setSelectedPreset] = useState<'SSS_1' | 'SSS_2'>('SSS_2');
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [decimals, setDecimals] = useState('6');
    const [uri, setUri] = useState('');
    const [result, setResult] = useState<{ mintAddress: string; txSignature: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const handleDecimalsChange = (value: string) => {
        // Allow empty for editing, only digits 0-9
        if (value === '') { setDecimals(''); return; }
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0 && n <= 9) setDecimals(String(n));
    };

    const handleCreate = async () => {
        if (!name || !symbol) {
            setError('Name and symbol are required');
            return;
        }

        const dec = parseInt(decimals || '6', 10);
        if (isNaN(dec) || dec < 0 || dec > 9) {
            setError('Decimals must be between 0 and 9');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const walletAdapter = (window as any).__solanaWallet;
            if (!walletAdapter?.publicKey) {
                throw new Error('Please connect your wallet first');
            }

            const res = await createStablecoin({
                preset: selectedPreset,
                name,
                symbol,
                decimals: dec,
                uri: uri || undefined,
                wallet: walletAdapter,
            });
            setResult(res);
        } catch (err: any) {
            setError(err.message || 'Failed to create stablecoin');
        }
        setLoading(false);
    };

    const copySnippet = () => {
        if (!result) return;
        const snippet = `import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const mintAddress = new PublicKey("${result.mintAddress}");

// Derive config PDA
const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), mintAddress.toBuffer()],
    PROGRAM_ID
);`;
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div>
            <h2 className="text-3xl font-bold gradient-text mb-8">Create Stablecoin</h2>

            {/* Preset Cards */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                {PRESETS.map((preset) => (
                    <div
                        key={preset.id}
                        onClick={() => setSelectedPreset(preset.id)}
                        className={`glass-card cursor-pointer ${selectedPreset === preset.id ? 'ring-2 ring-sss-primary' : ''}`}
                    >
                        <div className={`text-lg font-bold bg-gradient-to-r ${preset.color} bg-clip-text text-transparent mb-2`}>
                            {preset.name}
                        </div>
                        <p className="text-sm text-gray-400 mb-4">{preset.description}</p>
                        <ul className="space-y-1">
                            {preset.features.map((f) => (
                                <li key={f} className="text-xs text-gray-300">✓ {f}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {/* Form */}
            <div className="glass-card mb-8">
                <h3 className="text-lg font-semibold mb-4">Token Details</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Name</label>
                        <input
                            className="w-full"
                            placeholder="e.g. My USD"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={32}
                        />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Symbol</label>
                        <input
                            className="w-full"
                            placeholder="e.g. MUSD"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            maxLength={10}
                        />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Decimals <span className="text-gray-500">(0–9)</span></label>
                        <input
                            className="w-full"
                            inputMode="numeric"
                            placeholder="6"
                            value={decimals}
                            onChange={(e) => handleDecimalsChange(e.target.value)}
                            maxLength={1}
                        />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Metadata URI <span className="text-gray-500">(optional)</span></label>
                        <input
                            className="w-full"
                            placeholder="https://arweave.net/..."
                            value={uri}
                            onChange={(e) => setUri(e.target.value)}
                        />
                    </div>
                </div>

                {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-900/30 text-red-400 text-sm">{error}</div>
                )}

                <button
                    onClick={handleCreate}
                    disabled={loading || !name || !symbol}
                    className="btn-primary mt-6 w-full disabled:opacity-50"
                >
                    {loading ? 'Deploying...' : `Deploy ${selectedPreset === 'SSS_1' ? 'SANCTION-1' : 'SANCTION-2'} Stablecoin`}
                </button>
            </div>

            {/* Result */}
            {result && (
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-green-400 mb-4">✔ Stablecoin Created!</h3>
                    <div className="space-y-2">
                        <div>
                            <span className="text-sm text-gray-400">Mint Address: </span>
                            <code className="text-sm text-sss-accent">{result.mintAddress}</code>
                        </div>
                        <div>
                            <span className="text-sm text-gray-400">Transaction: </span>
                            <a href={`https://explorer.solana.com/tx/${result.txSignature}?cluster=devnet`}
                                className="text-sm text-sss-primary hover:underline" target="_blank" rel="noreferrer">
                                {result.txSignature.slice(0, 20)}... ↗
                            </a>
                        </div>
                        <div>
                            <span className="text-sm text-gray-400">Explorer: </span>
                            <a href={`https://explorer.solana.com/address/${result.mintAddress}?cluster=devnet`}
                                className="text-sm text-sss-primary hover:underline" target="_blank" rel="noreferrer">
                                View Mint on Explorer ↗
                            </a>
                        </div>
                        <button onClick={copySnippet} className="text-sm text-sss-primary hover:text-sss-accent mt-2">
                            {copied ? '✓ Copied!' : '📋 Copy SDK Snippet'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
