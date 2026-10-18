import React, { useState } from 'react';
import { loadLocal, saveLocal, STORAGE_KEYS } from '../lib/storage';
import { toast } from './Toaster';

const ToneSettings = ({ socket, onClose }) => {
    const saved = loadLocal(STORAGE_KEYS.settings, {});
    const [role, setRole] = useState(saved.role || "Software Engineer");
    const [company, setCompany] = useState(saved.company || "General Tech");
    const [tone, setTone] = useState(saved.tone || "Confident");
    const [detailLevel, setDetailLevel] = useState(saved.detailLevel || "Concise");

    const handleSave = () => {
        const settings = { role, company, tone, detailLevel };
        socket.emit('updateSettings', settings);
        saveLocal(STORAGE_KEYS.settings, settings);
        toast('Context saved — answers will match this role', 'success');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[20px] border shadow-2xl overflow-hidden animate-fade-up" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <div className="p-6 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2">⚙️ Make it yours</h2>
                        <button onClick={onClose} className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>The AI tailors every answer to this. Keep it simple.</p>
                </div>

                <div className="p-6 space-y-4">
                    <label className="block">
                        <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>Target role</span>
                        <input
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="e.g. Frontend Engineer"
                            className="mt-1.5 w-full rounded-xl border px-3.5 py-3 text-sm"
                            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                    </label>

                    <label className="block">
                        <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>Company</span>
                        <input
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            placeholder="e.g. Google, Startup"
                            className="mt-1.5 w-full rounded-xl border px-3.5 py-3 text-sm"
                            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>Tone</span>
                            <select
                                value={tone}
                                onChange={(e) => setTone(e.target.value)}
                                className="mt-1.5 w-full rounded-xl border px-3 py-3 text-sm"
                                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                            >
                                <option>Professional</option>
                                <option>Confident</option>
                                <option>Casual</option>
                                <option>Friendly</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>Detail</span>
                            <select
                                value={detailLevel}
                                onChange={(e) => setDetailLevel(e.target.value)}
                                className="mt-1.5 w-full rounded-xl border px-3 py-3 text-sm"
                                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                            >
                                <option>Concise</option>
                                <option>Detailed</option>
                            </select>
                        </label>
                    </div>
                </div>

                <div className="p-6 pt-0">
                    <button onClick={handleSave} className="w-full py-3 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium">
                        Save and continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ToneSettings;
