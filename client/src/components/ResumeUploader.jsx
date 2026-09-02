import React, { useState } from 'react';
import { toast } from './Toaster';

const ResumeUploader = ({ socket, apiBaseUrl, onClose }) => {
    const [resumeText, setResumeText] = useState("");
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (resumeText.trim().length < 10) { setStatus("Add a bit more text — at least a paragraph."); return; }
        socket.emit('updateResume', resumeText);
        toast('Resume context active — try the Copilot now', 'success');
        setTimeout(() => onClose(), 900);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-[20px] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-fade-up">
                <div className="mesh-hero p-6 pb-5 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-white">Add your resume</h2>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center">✕</button>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">Upload a file or paste text. The AI will tailor every answer to you.</p>
                </div>

                <div className="p-6 space-y-4">
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-4">
                        <div className="text-[11px] font-bold tracking-widest uppercase text-slate-500 mb-2">Upload file</div>
                        <input
                            type="file"
                            accept=".pdf,.docx,.txt"
                            onChange={async (e) => {
                                const file = e.target.files[0]; if (!file) return;
                                setUploading(true); setStatus("Reading file…");
                                const formData = new FormData(); formData.append('file', file);
                                try {
                                    const res = await fetch(`${apiBaseUrl}/api/upload-resume`, { method: 'POST', body: formData });
                                    const data = await res.json();
                                    if (data.success) { setResumeText(data.text); setStatus(`Ready — ${(data.text.length/1000).toFixed(1)}k characters`); }
                                    else setStatus(`Error: ${data.error || "Unknown"}`);
                                } catch (err) { setStatus(`Network error: ${err.message}`); }
                                finally { setUploading(false); }
                            }}
                            className="block w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-white file:text-slate-900 hover:file:bg-slate-100 cursor-pointer"
                        />
                        {uploading && <p className="text-xs font-semibold text-sky-300 mt-2">Processing…</p>}
                        {status && <p className="text-xs font-bold text-emerald-300 mt-2">{status}</p>}
                    </div>

                    <div className="text-center text-[11px] font-bold tracking-widest uppercase text-slate-600">— or paste —</div>

                    <label className="block">
                        <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Paste resume text</span>
                        <textarea value={resumeText} onChange={(e)=>setResumeText(e.target.value)} placeholder="Paste your resume here… The more detail, the better the AI can personalize." className="mt-1.5 w-full h-36 rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-violet-500 resize-none leading-relaxed" />
                    </label>
                </div>

                <div className="p-6 pt-0">
                    <button onClick={handleSubmit} className="w-full py-3 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium">
                        Use this resume
                    </button>
                    <p className="text-xs text-center mt-2" style={{ color: 'var(--text-faint)'}}>Stored only in this session.</p>
                </div>
            </div>
        </div>
    );
};

export default ResumeUploader;
