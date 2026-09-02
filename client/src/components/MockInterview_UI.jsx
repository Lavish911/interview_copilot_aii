import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { loadLocal, saveLocal, STORAGE_KEYS } from '../lib/storage';
import { toast } from './Toaster';

const MockInterviewUI = ({ socket, onExit }) => {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(false);
    const [questionCount, setQuestionCount] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [, setHistory] = useState(() => loadLocal(STORAGE_KEYS.mockHistory, []));
    const questionStartRef = useRef(null);
    const answerRef = useRef(null);

    useEffect(() => { answerRef.current = answer; }, [answer]);
    useEffect(() => {
        const id = setInterval(() => { if (questionStartRef.current && !feedback) setElapsed(Math.floor((Date.now() - questionStartRef.current)/1000)); }, 1000);
        return () => clearInterval(id);
    }, [feedback]);

    const speakText = (text) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const synth = window.speechSynthesis;
        const pick = () => {
            const voices = synth.getVoices();
            const preferred = voices.find(v => v.name.includes('Google US English')) || voices[0];
            const u = new SpeechSynthesisUtterance(text);
            if (preferred) u.voice = preferred;
            u.rate = 1.0; synth.speak(u);
        };
        if (synth.getVoices().length === 0) synth.onvoiceschanged = () => { pick(); synth.onvoiceschanged = null; };
        else pick();
    };

    useEffect(() => {
        socket.on('mockQuestion', (q) => {
            setQuestion(q); setFeedback(null); setAnswer(""); setLoading(false);
            setQuestionCount(c => c + 1); questionStartRef.current = Date.now(); setElapsed(0); speakText(q);
        });
        socket.on('mockFeedback', (data) => {
            const fb = data || { score: 0, feedback: "Error", betterAnswer: "N/A" };
            setFeedback(fb); setLoading(false);
            const seconds = questionStartRef.current ? Math.round((Date.now() - questionStartRef.current)/1000) : 0;
            const entry = { question, answer: answerRef.current, score: fb.score, feedback: fb.feedback, at: Date.now(), seconds };
            setHistory(prev => { const next = [...prev, entry].slice(-50); saveLocal(STORAGE_KEYS.mockHistory, next); return next; });
            if (fb.score) speakText(`I give that a ${fb.score} out of 10.`);
        });
        return () => { socket.off('mockQuestion'); socket.off('mockFeedback'); window.speechSynthesis.cancel(); };
    }, [socket, question]);

    const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

    return (
        <div className="p-6 md:p-8 max-w-[860px] mx-auto w-full">
            <div className="cluely-hero p-6 flex items-start justify-between gap-4 mb-6">
                <div>
                    <div className="text-[11px] tracking-wide uppercase" style={{ color: 'var(--text-faint)' }}>Mock Interview</div>
                    <h2 className="text-xl font-semibold tracking-tight mt-1">Practice like it's real</h2>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{questionCount ? `Question #${questionCount}` : 'Not started'}</div>
                </div>
                <button onClick={onExit} className="px-3 py-2 rounded-lg border text-xs font-medium" style={{ borderColor: 'var(--border)' }}>Exit</button>
            </div>

            {!question ? (
                <div className="card p-8 text-center">
                    <h3 className="text-[15px] font-semibold">Ready?</h3>
                    <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>One question at a time, tailored to your resume. Get a score and a perfect answer.</p>
                    <button onClick={() => { setLoading(true); socket.emit('startMockInterview'); }} disabled={loading} className="mt-5 px-6 py-2.5 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium disabled:opacity-50">
                        {loading ? 'Getting question…' : 'Start Interview'}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="card p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] tracking-wide uppercase" style={{ color: 'var(--text-faint)' }}>Interviewer asks</span>
                            <span className="text-xs font-mono px-2 py-1 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{fmt(elapsed)}</span>
                        </div>
                        <h3 className="text-[15px] font-medium leading-relaxed">{question}</h3>
                    </div>

                    <div className="card p-4">
                        <div className="text-[11px] tracking-wide uppercase mb-2" style={{ color: 'var(--text-faint)' }}>Your answer</div>
                        <textarea value={answer} onChange={(e)=>setAnswer(e.target.value)} placeholder="Use STAR: Situation, Task, Action, Result." className="w-full h-32 rounded-lg border p-3 text-[13px] leading-relaxed resize-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                        {!feedback && (
                            <button onClick={() => { setLoading(true); socket.emit('submitMockAnswer', { question, answer }); }} disabled={loading || !answer.trim()} className="mt-3 w-full py-2.5 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium disabled:opacity-50">
                                {loading ? 'Scoring…' : 'Submit answer'}
                            </button>
                        )}
                    </div>

                    {feedback && (
                        <div className="card p-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[13px] font-semibold">Feedback</span>
                                <span className="w-9 h-9 rounded-full bg-[#0A0A0A] dark:bg-white text-white dark:text-black flex items-center justify-center text-sm font-semibold">{feedback.score}</span>
                            </div>
                            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text)' }}>{feedback.feedback}</p>
                            <div className="mt-3 rounded-lg border p-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                                <div className="text-[11px] tracking-wide uppercase mb-1" style={{ color: 'var(--text-faint)' }}>Perfect answer</div>
                                <ReactMarkdown className="prose prose-sm max-w-none text-[13px]" style={{ color: 'var(--text)' }}>{feedback.betterAnswer}</ReactMarkdown>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <button onClick={() => { navigator.clipboard.writeText(feedback.betterAnswer||''); toast('Copied','success'); }} className="px-4 py-2 rounded-lg border text-[13px] font-medium" style={{ borderColor: 'var(--border)' }}>Copy</button>
                                <button onClick={() => { setFeedback(null); setAnswer(""); setLoading(true); socket.emit('startMockInterview'); }} className="flex-1 py-2 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium">Next question</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MockInterviewUI;
