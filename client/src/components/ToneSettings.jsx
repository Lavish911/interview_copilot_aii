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
            <div className="w-full max-w-md rounded-[20px] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-fade-up">
                <div className="mesh-hero p-6 pb-5 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-white flex items-center gap-2">⚙️ Make it yours</h2>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center">✕</button>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">The AI tailors every answer to this. Keep it simple.</p>
                </div>

                <div className="p-6 space-y-4">
                    <label className="block">
                        <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Target role</span>
                        <input value={role} onChange={(e)=>setRole(e.target.value)} placeholder="e.g. Frontend Engineer" className="mt-1.5 w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500" />
                    </label>

                    <label className="block">
                        <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Company</span>
                        <input value={company} onChange={(e)=>setCompany(e.target.value)} placeholder="e.g. Google, Startup" className="mt-1.5 w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500" />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Tone</span>
                            <select value={tone} onChange={(e)=>setTone(e.target.value)} className="mt-1.5 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-3 text-sm text-white">
                                <option>Professional</option><option>Confident</option><option>Casual</option><option>Friendly</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Detail</span>
                            <select value={detailLevel} onChange={(e)=>setDetailLevel(e.target.value)} className="mt-1.5 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-3 text-sm text-white">
                                <option>Concise</option><option>Detailed</option>
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
