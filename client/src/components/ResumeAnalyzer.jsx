import React, { useState, useEffect } from 'react';
import { saveLocal, STORAGE_KEYS } from '../lib/storage';
import { toast } from './Toaster';

const ScoreGauge = ({ score }) => {
    const s = Math.max(0, Math.min(100, Number(score)||0));
    const R=54, C=2*Math.PI*R;
    const color = s>80?'#0A0A0A':s>60?'#525252':'#DC2626';
    return (
        <div className="relative w-32 h-32 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
                <circle cx="64" cy="64" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C*s)/100} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold">{s}</span>
                <span className="text-xs" style={{ color:'var(--text-faint)'}}>/ 100</span>
            </div>
        </div>
    );
};

const ResumeAnalyzer = ({ socket, apiBaseUrl, onExit }) => {
    const [analysis, setAnalysis] = useState(null);
    const [coverLetter, setCoverLetter] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('ats');
    const [questions, setQuestions] = useState([]);
    const [status, setStatus] = useState("");
    const [showUploader, setShowUploader] = useState(false);

    const handleFile = async (e) => {
        const file=e.target.files[0]; if(!file) return;
        setStatus("Reading…");
        const fd=new FormData(); fd.append('file', file);
        try{
            const res=await fetch(`${apiBaseUrl}/api/upload-resume`,{method:'POST',body:fd});
            const data=await res.json();
            if(data.success){ setStatus(`Ready — ${(data.text.length/1000).toFixed(1)}k`); toast('Resume ready','success'); }
            else { setStatus(data.error||'Failed'); toast('Upload failed','error'); }
        } catch { setStatus('Network error'); }
    };

    useEffect(()=>{
        socket.emit('requestSessionState');
        socket.on('sessionStateUpdate', (d)=>{ if(d.analysis) setAnalysis(d.analysis); if(d.coverLetter) setCoverLetter(d.coverLetter); });
        socket.on('resumeAnalysisResult', (d)=>{ setAnalysis(d); setLoading(false); if(d?.score) saveLocal(STORAGE_KEYS.atsScore,d); });
        socket.on('coverLetterResult', (t)=>{ setCoverLetter(t); setLoading(false); });
        socket.on('predictionResult', (qs)=>{ setQuestions(qs); setLoading(false); });
        return ()=>{ socket.off('sessionStateUpdate'); socket.off('resumeAnalysisResult'); socket.off('coverLetterResult'); socket.off('predictionResult'); };
    },[socket]);

    return (
        <div className="p-6 md:p-8 max-w-[860px] mx-auto w-full">
            <div className="cluely-hero p-6 flex items-start justify-between gap-4 mb-6">
                <div>
                    <div className="text-[11px] tracking-wide uppercase" style={{ color:'var(--text-faint)'}}>Resume Studio</div>
                    <h2 className="text-xl font-semibold tracking-tight mt-1">Make it match</h2>
                    <p className="text-[13px] mt-1" style={{ color:'var(--text-muted)'}}>Paste a job post, get a score and a cover letter.</p>
                </div>
                <button onClick={onExit} className="px-3 py-2 rounded-lg border text-xs font-medium" style={{ borderColor:'var(--border)'}}>Exit</button>
            </div>

            <div className="card p-4 mb-4">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] tracking-wide uppercase" style={{ color:'var(--text-faint)'}}>Your resume</span>
                    <button onClick={()=>setShowUploader(!showUploader)} className="text-xs font-medium underline" style={{ color:'var(--text)'}}>{showUploader?'Hide':'Change'}</button>
                </div>
                {status && <div className="mt-2 text-xs px-2.5 py-1 rounded-full border w-fit" style={{ borderColor:'var(--border)', color:'var(--text-muted)'}}>{status}</div>}
                {showUploader && <div className="mt-3"><input type="file" accept=".pdf,.docx,.txt,image/*" onChange={handleFile} className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-[#0A0A0A] dark:file:bg-white file:text-white dark:file:text-black" /></div>}
            </div>

            <div className="card p-4 mb-4">
                <div className="text-[11px] tracking-wide uppercase mb-2" style={{ color:'var(--text-faint)'}}>Job description</div>
                <textarea value={jobDescription} onChange={(e)=>setJobDescription(e.target.value)} placeholder="Paste job post here…" className="w-full h-28 rounded-lg border p-3 text-[13px] resize-none" style={{ background:'var(--surface-2)', borderColor:'var(--border)', color:'var(--text)'}} />
            </div>

            <div className="flex gap-2 mb-4">
                {[
                    {id:'ats',l:'ATS Score'},
                    {id:'coverLetter',l:'Cover Letter'},
                    {id:'predict',l:'Predict Qs'},
                ].map(t=>(
                    <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex-1 py-2.5 rounded-lg text-[13px] font-medium border ${activeTab===t.id?'bg-[#0A0A0A] text-white dark:bg-white dark:text-black':'bg-transparent'}`} style={activeTab!==t.id?{borderColor:'var(--border)', color:'var(--text-muted)'}:{borderColor:'#0A0A0A'}}>{t.l}</button>
                ))}
            </div>

            {activeTab==='ats' && (
                <div>
                    {loading ? <div className="skeleton h-40 rounded-xl" /> : !analysis ? (
                        <div className="card p-8 text-center">
                            <p className="text-[13px]" style={{ color:'var(--text-muted)'}}>Get your match score.</p>
                            <button onClick={()=>{ setLoading(true); socket.emit('analyzeResume',{jobDescription}); }} className="mt-4 px-6 py-2.5 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium">Run scan</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="card p-5 flex items-center gap-5">
                                <ScoreGauge score={analysis.score} />
                                <div>
                                    <div className="text-[11px] tracking-wide uppercase" style={{ color:'var(--text-faint)'}}>Verdict</div>
                                    <p className="text-[13px] font-medium mt-1 leading-relaxed">{analysis.summary}</p>
                                </div>
                            </div>
                            <div className="card p-4">
                                <div className="text-xs font-semibold mb-2">Missing keywords</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(analysis.keywords_missing||[]).map((kw,i)=><span key={i} className="px-2.5 py-1 rounded-full text-xs border" style={{ borderColor:'var(--border)', background:'var(--surface-2)'}}>{kw}</span>)}
                                </div>
                            </div>
                            <div className="card p-4">
                                <div className="text-xs font-semibold mb-2">Fixes</div>
                                <div className="space-y-2">
                                    {(analysis.improvements||[]).map((it,i)=>(
                                        <div key={i} className="rounded-lg border p-3" style={{ borderColor:'var(--border)', background:'var(--surface-2)'}}>
                                            <div className="text-xs line-through" style={{ color:'var(--text-faint)'}}>{it.original}</div>
                                            <div className="text-[13px] font-medium mt-1">→ {it.improved}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab==='coverLetter' && (
                <div>
                    {loading ? <div className="skeleton h-48 rounded-xl" /> : !coverLetter ? (
                        <div className="card p-8 text-center">
                            <p className="text-[13px]" style={{ color:'var(--text-muted)'}}>Generate a tailored cover letter.</p>
                            <button onClick={()=>{ if(!jobDescription.trim()) return toast('Paste job description','error'); setLoading(true); socket.emit('generateCoverLetter',{jobDescription}); }} className="mt-4 px-6 py-2.5 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium">Generate</button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="rounded-xl border p-6 text-[13px] leading-relaxed whitespace-pre-wrap" style={{ background:'white', color:'#0A0A0A', borderColor:'var(--border)'}}>{coverLetter}</div>
                            <div className="flex gap-2">
                                <button onClick={()=>{ navigator.clipboard.writeText(coverLetter); toast('Copied','success'); }} className="flex-1 py-2.5 rounded-lg border text-[13px] font-medium" style={{ borderColor:'var(--border)'}}>Copy</button>
                                <button onClick={()=>{ const b=new Blob([coverLetter],{type:'text/plain'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='cover-letter.txt'; a.click(); URL.revokeObjectURL(u); }} className="flex-1 py-2.5 rounded-lg border text-[13px] font-medium" style={{ borderColor:'var(--border)'}}>Download</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab==='predict' && (
                <div>
                    {loading ? <div className="skeleton h-40 rounded-xl" /> : !questions.length ? (
                        <div className="card p-8 text-center">
                            <button onClick={()=>{ setLoading(true); socket.emit('predictQuestions'); }} className="px-6 py-2.5 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium">Predict questions</button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {questions.map((q,i)=><div key={i} className="card p-4 text-[13px] flex gap-2"><span style={{ color:'var(--text-faint)'}}>Q{i+1}.</span> {q}</div>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResumeAnalyzer;
