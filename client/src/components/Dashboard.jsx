import React, { useState, useEffect } from 'react';
import { loadLocal, STORAGE_KEYS } from '../lib/storage';

const Dashboard = ({ onStartMock, onStartCopilot, onNavigate }) => {
    const [history, setHistory] = useState([]);
    const [ats, setAts] = useState(null);
    const [greeting, setGreeting] = useState('Hello');

    useEffect(() => {
        const h = new Date().getHours();
        setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
        const refresh = () => {
            setHistory(loadLocal(STORAGE_KEYS.mockHistory, []));
            setAts(loadLocal(STORAGE_KEYS.atsScore, null));
        };
        refresh();
        const id = setInterval(refresh, 2000);
        return () => clearInterval(id);
    }, []);

    const count = history.length;
    const avg = count ? (history.reduce((s, h) => s + (Number(h.score) || 0), 0) / count).toFixed(1) : '—';
    const best = count ? Math.max(...history.map(h => Number(h.score) || 0)) : '—';

    return (
        <div className="p-6 md:p-8 max-w-[960px] mx-auto w-full">
            <div className="cluely-hero p-7 md:p-8 mb-6">
                <div className="text-[11px] font-medium tracking-wide uppercase" style={{ color: 'var(--text-faint)' }}>Prep Studio</div>
                <h1 className="mt-2 text-[28px] md:text-[32px] font-semibold tracking-tight leading-tight">
                    {greeting}. <span style={{ color: 'var(--text-muted)' }}>Ace your next interview.</span>
                </h1>
                <p className="mt-2 text-[13px] leading-relaxed max-w-xl" style={{ color: 'var(--text-muted)' }}>
                    Practice speaking, fix your resume, run code, and track progress. Everything stays in your browser.
                </p>
                <div className="mt-5 flex gap-3">
                    <button onClick={onStartCopilot} className="px-4 py-2.5 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium">
                        Start Copilot
                    </button>
                    <button onClick={onStartMock} className="px-4 py-2.5 rounded-lg border text-[13px] font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                        Mock Interview
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {[
                    { id: 'copilot', t: 'Live Copilot', d: 'Speak or share screen. Get the answer instantly.', a: onStartCopilot },
                    { id: 'mock', t: 'Mock Interview', d: 'Practice with AI and get scored feedback.', a: onStartMock },
                    { id: 'resume', t: 'Resume Studio', d: 'ATS score, fixes, and cover letter.', a: () => onNavigate?.('resume') },
                    { id: 'code', t: 'Code Lab', d: 'Write and run JavaScript safely.', a: () => onNavigate?.('code') },
                ].map(f => (
                    <button key={f.id} onClick={f.a} className="card card-hover p-5 text-left">
                        <div className="text-[13px] font-semibold">{f.t}</div>
                        <div className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.d}</div>
                        <div className="mt-3 text-xs font-medium" style={{ color: 'var(--text-faint)' }}>Open →</div>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                    { l: 'Sessions', v: count, s: 'all time' },
                    { l: 'Avg score', v: avg, s: '/ 10' },
                    { l: 'Best', v: best, s: '/ 10' },
                    { l: 'Resume', v: ats ? `${ats.score}%` : '—', s: 'match' },
                ].map(item => (
                    <div key={item.l} className="card p-4">
                        <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{item.l}</div>
                        <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-xl font-semibold">{item.v}</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.s}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card p-5 mb-6">
                <div className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-faint)' }}>How it works</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px]">
                    <div><span className="font-semibold">1. Add context</span><div style={{ color: 'var(--text-muted)' }}>Upload resume, set role in Settings.</div></div>
                    <div><span className="font-semibold">2. Practice</span><div style={{ color: 'var(--text-muted)' }}>Use Copilot or Mock out loud.</div></div>
                    <div><span className="font-semibold">3. Improve</span><div style={{ color: 'var(--text-muted)' }}>Track Insights, re-run ATS to 90+.</div></div>
                </div>
            </div>

            {count > 0 && (
                <div className="card p-5">
                    <div className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-faint)' }}>Recent</div>
                    <div className="space-y-2">
                        {[...history].reverse().slice(0, 4).map((h, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                                <span className="w-7 h-7 rounded-full bg-[#0A0A0A] dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-semibold">{h.score ?? '—'}</span>
                                <span className="flex-1 truncate text-[13px]">{h.question}</span>
                                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{new Date(h.at).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
