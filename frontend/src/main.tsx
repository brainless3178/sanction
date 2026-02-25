import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { CreatePage } from './pages/Create/index';
import { ManagePage } from './pages/Manage/index';
import { CompliancePage } from './pages/Compliance/index';

const ShieldIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="64 32 384 448" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
            d="M96 128 L256 64 L416 128 V304 C416 352 336 400 256 448 C176 400 96 352 96 304 Z"
            fill="none"
            stroke="#a5b4fc"
            strokeWidth="18"
            strokeLinejoin="round"
        />
        <line x1="160" y1="256" x2="352" y2="256"
            stroke="#a5b4fc" strokeWidth="24" strokeLinecap="square" />
        <path d="M176 224 L224 256 L176 288"
            fill="none" stroke="#a5b4fc" strokeWidth="18" strokeLinecap="square" />
        <rect x="288" y="224" width="48" height="64" fill="#a5b4fc" />
        <rect x="252" y="248" width="8" height="16" fill="#0f172a" />
    </svg>
);

const Nav: React.FC = () => (
    <nav className="flex items-center justify-between px-8 py-4 border-b border-sss-border">
        <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
                <ShieldIcon size={28} />
                <span className="text-xl font-bold tracking-wider gradient-text">SANCTION</span>
            </a>
            <span className="text-xs bg-sss-primary/20 text-sss-accent px-2 py-0.5 rounded-full">Devnet</span>
        </div>
        <div className="flex gap-6">
            <a href="/create" className="text-sm hover:text-sss-primary transition-colors">Create</a>
            <a href="/manage/demo" className="text-sm hover:text-sss-primary transition-colors">Manage</a>
            <a href="/compliance/demo" className="text-sm hover:text-sss-primary transition-colors">Compliance</a>
        </div>
    </nav>
);

const App: React.FC = () => (
    <BrowserRouter>
        <Nav />
        <main className="max-w-6xl mx-auto px-8 py-8">
            <Routes>
                <Route path="/" element={<CreatePage />} />
                <Route path="/create" element={<CreatePage />} />
                <Route path="/manage/:mint" element={<ManagePage />} />
                <Route path="/compliance/:mint" element={<CompliancePage />} />
            </Routes>
        </main>
    </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
