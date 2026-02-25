import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getSupplyInfo, getMinters, subscribeToEvents } from '../../lib/sdk';

export const ManagePage: React.FC = () => {
    const { mint } = useParams<{ mint: string }>();
    const [supply, setSupply] = useState({ circulating: '0', totalMinted: '0', totalBurned: '0' });
    const [minters, setMinters] = useState<Array<{ address: string; quota: number; used: number }>>([]);
    const [mintTo, setMintTo] = useState('');
    const [mintAmount, setMintAmount] = useState('');
    const [freezeAddr, setFreezeAddr] = useState('');
    const [events, setEvents] = useState<Array<{ time: string; type: string; detail: string }>>([]);
    const [actionStatus, setActionStatus] = useState('');

    // Fetch supply from on-chain
    useEffect(() => {
        if (!mint) return;
        const fetchSupply = async () => {
            const info = await getSupplyInfo(mint);
            setSupply(info);
        };
        fetchSupply();
        const interval = setInterval(fetchSupply, 5000);
        return () => clearInterval(interval);
    }, [mint]);

    // Fetch minters from on-chain
    useEffect(() => {
        if (!mint) return;
        const fetchMinters = async () => {
            const data = await getMinters(mint);
            setMinters(data);
        };
        fetchMinters();
        const interval = setInterval(fetchMinters, 15000);
        return () => clearInterval(interval);
    }, [mint]);

    // Subscribe to real-time on-chain events via WebSocket
    useEffect(() => {
        if (!mint) return;
        const unsubscribe = subscribeToEvents(mint, (event) => {
            setEvents((prev) => [event, ...prev].slice(0, 20));
        });
        return unsubscribe;
    }, [mint]);

    const handleMint = () => {
        if (!mintTo || !mintAmount) {
            setActionStatus('✗ Fill in recipient and amount');
            setTimeout(() => setActionStatus(''), 3000);
            return;
        }
        setActionStatus('⏳ Connect a wallet to mint tokens on-chain');
        setTimeout(() => setActionStatus(''), 4000);
    };

    const handleFreeze = () => {
        if (!freezeAddr) {
            setActionStatus('✗ Enter a token account address');
            setTimeout(() => setActionStatus(''), 3000);
            return;
        }
        setActionStatus('⏳ Connect a wallet to freeze accounts on-chain');
        setTimeout(() => setActionStatus(''), 4000);
    };

    const handleThaw = () => {
        if (!freezeAddr) {
            setActionStatus('✗ Enter a token account address');
            setTimeout(() => setActionStatus(''), 3000);
            return;
        }
        setActionStatus('⏳ Connect a wallet to thaw accounts on-chain');
        setTimeout(() => setActionStatus(''), 4000);
    };

    const handleAmountChange = (value: string) => {
        // Only allow digits and a single decimal point
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setMintAmount(value);
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold gradient-text mb-2">Manage Stablecoin</h2>
            <p className="text-sm text-gray-400 mb-8 font-mono">{mint}</p>

            {actionStatus && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${actionStatus.startsWith('✗') ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
                    {actionStatus}
                </div>
            )}

            {/* Supply Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="glass-card text-center">
                    <div className="text-sm text-gray-400">Circulating</div>
                    <div className="text-2xl font-bold text-green-400">{supply.circulating}</div>
                </div>
                <div className="glass-card text-center">
                    <div className="text-sm text-gray-400">Total Minted</div>
                    <div className="text-2xl font-bold text-blue-400">{supply.totalMinted}</div>
                </div>
                <div className="glass-card text-center">
                    <div className="text-sm text-gray-400">Total Burned</div>
                    <div className="text-2xl font-bold text-red-400">{supply.totalBurned}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Mint Form */}
                <div className="glass-card">
                    <h3 className="text-lg font-semibold mb-4">Mint Tokens</h3>
                    <div className="space-y-3">
                        <input
                            className="w-full"
                            placeholder="Recipient address"
                            value={mintTo}
                            onChange={(e) => setMintTo(e.target.value)}
                        />
                        <input
                            className="w-full"
                            placeholder="Amount (e.g. 1000)"
                            inputMode="decimal"
                            value={mintAmount}
                            onChange={(e) => handleAmountChange(e.target.value)}
                        />
                        <button
                            className="btn-primary w-full"
                            onClick={handleMint}
                            disabled={!mintTo || !mintAmount}
                        >
                            Mint Tokens
                        </button>
                    </div>
                </div>

                {/* Freeze/Thaw */}
                <div className="glass-card">
                    <h3 className="text-lg font-semibold mb-4">Freeze / Thaw</h3>
                    <div className="space-y-3">
                        <input
                            className="w-full"
                            placeholder="Token account address"
                            value={freezeAddr}
                            onChange={(e) => setFreezeAddr(e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                className="btn-primary"
                                onClick={handleFreeze}
                                disabled={!freezeAddr}
                            >
                                ❄️ Freeze
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={handleThaw}
                                disabled={!freezeAddr}
                            >
                                🔓 Thaw
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Minters Table */}
            <div className="glass-card mb-8">
                <h3 className="text-lg font-semibold mb-4">Active Minters</h3>
                {minters.length === 0 ? (
                    <p className="text-sm text-gray-400">No minters found. Add a minter via the CLI or SDK.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 border-b border-sss-border">
                                <th className="text-left py-2">Address</th>
                                <th className="text-left py-2">Quota</th>
                                <th className="text-left py-2">Usage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {minters.map((m, i) => {
                                const usagePct = m.quota > 0 ? (m.used / m.quota) * 100 : 0;
                                return (
                                    <tr key={i} className="border-b border-sss-border/50">
                                        <td className="py-2 font-mono text-xs">{m.address.slice(0, 8)}...{m.address.slice(-4)}</td>
                                        <td className="py-2">{m.quota.toLocaleString()}</td>
                                        <td className="py-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-sss-dark rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${usagePct > 80 ? 'bg-red-500' : 'bg-green-500'}`}
                                                        style={{ width: `${Math.min(usagePct, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-400">{Math.round(usagePct)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Event Feed */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold mb-4">Real-Time Event Feed <span className="text-xs text-green-400 animate-pulse">● Live</span></h3>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                    {events.length === 0 ? (
                        <p className="text-sm text-gray-400">Listening for on-chain events...</p>
                    ) : (
                        events.map((e, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-sss-border/30">
                                <span className="text-gray-500 w-12">{e.time}</span>
                                <span className={`font-bold w-16 ${e.type === 'MINT' ? 'text-green-400' : e.type === 'BURN' ? 'text-red-400' : e.type === 'FREEZE' ? 'text-blue-400' : 'text-yellow-400'}`}>
                                    {e.type}
                                </span>
                                <span className="text-gray-400 font-mono">{e.detail}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
