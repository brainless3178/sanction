import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchAuditLog, getBlacklistEntries } from '../../lib/sdk';

export const CompliancePage: React.FC = () => {
    const { mint } = useParams<{ mint: string }>();
    const [blacklistAddr, setBlacklistAddr] = useState('');
    const [blacklistReason, setBlacklistReason] = useState('');
    const [seizeSource, setSeizeSource] = useState('');
    const [seizeDest, setSeizeDest] = useState('');
    const [auditFilter, setAuditFilter] = useState('');
    const [blacklistEntries, setBlacklistEntries] = useState<Array<{ address: string; reason: string; addedAt: string }>>([]);
    const [auditEvents, setAuditEvents] = useState<Array<{ type: string; timestamp: string; target: string; reason: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [actionStatus, setActionStatus] = useState('');

    const COMPLIANCE_API = import.meta.env.VITE_COMPLIANCE_API || 'http://localhost:3002';

    // Load blacklist entries from the compliance API
    useEffect(() => {
        if (!mint) return;
        const load = async () => {
            const entries = await getBlacklistEntries(mint);
            setBlacklistEntries(entries);
        };
        load();
    }, [mint]);

    // Load audit events from the compliance API
    useEffect(() => {
        if (!mint) return;
        const load = async () => {
            try {
                const result = await fetchAuditLog(mint, 'json', auditFilter || undefined);
                setAuditEvents(result.data || []);
            } catch {
                setAuditEvents([]);
            }
        };
        load();
    }, [mint, auditFilter]);

    // Add address to blacklist via compliance API
    const handleAddToBlacklist = async () => {
        if (!blacklistAddr || !blacklistReason || !mint) return;
        setLoading(true);
        try {
            const res = await fetch(`${COMPLIANCE_API}/api/blacklist/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mintAddress: mint, address: blacklistAddr, reason: blacklistReason }),
            });
            if (!res.ok) throw new Error(await res.text());
            setActionStatus(`✔ ${blacklistAddr.slice(0, 8)}... added to blacklist`);
            setBlacklistAddr('');
            setBlacklistReason('');
            const entries = await getBlacklistEntries(mint);
            setBlacklistEntries(entries);
        } catch (err: any) {
            setActionStatus(`✗ Failed: ${err.message}`);
        }
        setLoading(false);
        setTimeout(() => setActionStatus(''), 5000);
    };

    // Remove address from blacklist via compliance API
    const handleRemoveFromBlacklist = async (address: string) => {
        if (!mint) return;
        setLoading(true);
        try {
            const res = await fetch(`${COMPLIANCE_API}/api/blacklist/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mintAddress: mint, address }),
            });
            if (!res.ok) throw new Error(await res.text());
            setActionStatus(`✔ ${address.slice(0, 8)}... removed from blacklist`);
            const entries = await getBlacklistEntries(mint);
            setBlacklistEntries(entries);
        } catch (err: any) {
            setActionStatus(`✗ Failed: ${err.message}`);
        }
        setLoading(false);
        setTimeout(() => setActionStatus(''), 5000);
    };

    // Handle seize
    const handleSeize = () => {
        if (!seizeSource || !seizeDest) {
            setActionStatus('✗ Fill in source and destination addresses');
            setTimeout(() => setActionStatus(''), 3000);
            return;
        }
        setActionStatus('⏳ Connect a wallet to execute seizure on-chain');
        setTimeout(() => setActionStatus(''), 4000);
    };

    // Export audit trail as CSV
    const handleExportCSV = async () => {
        if (!mint) return;
        try {
            const csv = await fetchAuditLog(mint, 'csv', auditFilter || undefined);
            const blob = new Blob([csv as string], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_${mint}_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            setActionStatus(`✗ Export failed: ${err.message}`);
            setTimeout(() => setActionStatus(''), 5000);
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold gradient-text mb-2">Compliance Dashboard</h2>
            <p className="text-sm text-gray-400 mb-2 font-mono">{mint}</p>

            {actionStatus && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${actionStatus.startsWith('✔') ? 'bg-green-900/30 text-green-400' :
                        actionStatus.startsWith('✗') ? 'bg-red-900/30 text-red-400' :
                            'bg-blue-900/30 text-blue-400'
                    }`}>
                    {actionStatus}
                </div>
            )}

            <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Blacklist Management */}
                <div className="glass-card">
                    <h3 className="text-lg font-semibold mb-4">Blacklist Management</h3>
                    <div className="space-y-3 mb-6">
                        <input
                            className="w-full"
                            placeholder="Address to blacklist"
                            value={blacklistAddr}
                            onChange={(e) => setBlacklistAddr(e.target.value)}
                        />
                        <input
                            className="w-full"
                            placeholder="Reason (e.g., OFAC match)"
                            value={blacklistReason}
                            onChange={(e) => setBlacklistReason(e.target.value)}
                        />
                        <button
                            onClick={handleAddToBlacklist}
                            disabled={loading || !blacklistAddr || !blacklistReason}
                            className="btn-danger w-full"
                        >
                            🚫 Add to Blacklist
                        </button>
                    </div>

                    {/* Blacklist Table */}
                    <div className="border-t border-sss-border/30 pt-4">
                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Blacklisted Addresses</h4>
                        {blacklistEntries.length === 0 ? (
                            <p className="text-sm text-gray-500">No blacklisted addresses.</p>
                        ) : (
                            <div className="space-y-2">
                                {blacklistEntries.map((entry, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-red-900/10 border border-red-900/20">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-mono text-xs text-red-400 truncate">{entry.address}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{entry.reason} · {entry.addedAt}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFromBlacklist(entry.address)}
                                            disabled={loading}
                                            className="ml-3 text-xs text-gray-400 hover:text-green-400 transition-colors px-2 py-1 rounded border border-gray-600 hover:border-green-500"
                                        >
                                            Unblock
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Seize Funds */}
                <div className="glass-card">
                    <h3 className="text-lg font-semibold mb-4">Seize Funds</h3>
                    <p className="text-sm text-gray-400 mb-4">Transfer funds from a blacklisted account to treasury using the permanent delegate.</p>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Source (blacklisted account)</label>
                            <input
                                className="w-full"
                                placeholder="Source address"
                                value={seizeSource}
                                onChange={(e) => setSeizeSource(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Destination (treasury)</label>
                            <input
                                className="w-full"
                                placeholder="Treasury address"
                                value={seizeDest}
                                onChange={(e) => setSeizeDest(e.target.value)}
                            />
                        </div>
                        <button
                            className="btn-danger w-full"
                            onClick={handleSeize}
                            disabled={!seizeSource || !seizeDest}
                        >
                            ⚠️ Seize All Funds
                        </button>
                    </div>
                </div>
            </div>

            {/* Audit Log */}
            <div className="glass-card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Audit Log</h3>
                    <div className="flex gap-3">
                        <select className="text-sm" value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)}>
                            <option value="">All Events</option>
                            <option value="AddedToBlacklist">Blacklist Add</option>
                            <option value="RemovedFromBlacklist">Blacklist Remove</option>
                            <option value="FundsSeized">Seize</option>
                        </select>
                        <button onClick={handleExportCSV} className="btn-primary text-sm py-1 px-4">
                            📥 Export CSV
                        </button>
                    </div>
                </div>
                {auditEvents.length === 0 ? (
                    <p className="text-sm text-gray-400">No audit events yet.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 border-b border-sss-border">
                                <th className="text-left py-2">Time</th>
                                <th className="text-left py-2">Event</th>
                                <th className="text-left py-2">Target</th>
                                <th className="text-left py-2">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditEvents.map((event, i) => (
                                <tr key={i} className="border-b border-sss-border/30">
                                    <td className="py-2 text-xs text-gray-400">{new Date(event.timestamp).toLocaleString()}</td>
                                    <td className="py-2 text-xs font-bold" style={{
                                        color: event.type.includes('Add') ? '#f87171' :
                                            event.type.includes('Remove') ? '#4ade80' :
                                                event.type.includes('Seize') ? '#c084fc' : '#94a3b8'
                                    }}>
                                        {event.type}
                                    </td>
                                    <td className="py-2 text-xs font-mono">{event.target?.slice(0, 8)}...{event.target?.slice(-4)}</td>
                                    <td className="py-2 text-xs text-gray-400">{event.reason || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
