import React, { useState } from 'react';

const ToneSettings = ({ socket, onClose }) => {
    const [role, setRole] = useState("Software Engineer");
    const [company, setCompany] = useState("General Tech");
    const [tone, setTone] = useState("Confident");
    const [detailLevel, setDetailLevel] = useState("Concise");

    const handleSave = () => {
        socket.emit('updateSettings', { role, company, tone, detailLevel });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md p-6 rounded-xl shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>

                <h2 className="text-xl font-bold mb-6 text-white flex items-center">
                    <span className="mr-2">⚙️</span> Context & Tone
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Target Role</label>
                        <input
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:border-blue-500 outline-none"
                            placeholder="e.g. AI Engineer"
                        />
                    </div>

                    <div>
                        <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Target Company</label>
                        <input
                            type="text"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:border-blue-500 outline-none"
                            placeholder="e.g. Google, Startup"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Tone</label>
                            <select
                                value={tone}
                                onChange={(e) => setTone(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none"
                            >
                                <option>Professional</option>
                                <option>Confident</option>
                                <option>Casual</option>
                                <option>Friendly</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-slate-400 text-xs uppercase font-bold mb-1">Detail</label>
                            <select
                                value={detailLevel}
                                onChange={(e) => setDetailLevel(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none"
                            >
                                <option>Concise</option>
                                <option>Detailed</option>
                            </select>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-2 rounded-lg transition-all"
                >
                    Save Configuration
                </button>
            </div>
        </div>
    );
};

export default ToneSettings;
