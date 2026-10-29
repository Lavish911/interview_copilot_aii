import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import {
    LayoutDashboard,
    Mic,
    Code,
    FileText,
    BarChart2,
    Settings,
    Ghost,
    Sun,
    Moon
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import MockInterviewUI from './components/MockInterview_UI';
import ResumeAnalyzer from './components/ResumeAnalyzer';
import CodeEditor from './components/CodeEditor';
import Analytics from './components/Analytics';
import ToneSettings from './components/ToneSettings';
import SpeechInput from './components/SpeechInput';
import SuggestionPanel from './components/SuggestionPanel';
import StealthOverlay from './components/StealthOverlay';
import ResumeUploader from './components/ResumeUploader';
import ScreenWatcher from './components/ScreenWatcher';
import Toaster from './components/Toaster';
import { useTheme } from './hooks/useTheme';
import { loadLocal, STORAGE_KEYS } from './lib/storage';

// Resolve backend URL across Vercel (Render backend), Vite dev (port 5173 -> 3000), and unified same-origin (AI Studio / Render full-stack)
function resolveBackendUrl() {
    if (import.meta.env.VITE_SOCKET_URL) {
        return import.meta.env.VITE_SOCKET_URL.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined') {
        const { hostname, port, origin } = window.location;
        if (hostname.endsWith('.vercel.app')) {
            return 'https://interview-copilot-aii.onrender.com';
        }
        if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173') {
            return 'http://localhost:3000';
        }
        return origin;
    }
    return 'http://localhost:3000';
}

const BACKEND_URL = resolveBackendUrl();
const SOCKET_URL = BACKEND_URL;
const API_BASE_URL = (typeof window !== 'undefined' && BACKEND_URL === window.location.origin) ? '' : BACKEND_URL;
const socket = io(SOCKET_URL);

const NAV = [
    { id: 'dashboard', label: 'Home', Icon: LayoutDashboard },
    { id: 'copilot', label: 'Copilot', Icon: Mic },
    { id: 'mock', label: 'Mock', Icon: Ghost },
    { id: 'code', label: 'Code', Icon: Code },
    { id: 'resume', label: 'Resume', Icon: FileText },
    { id: 'analytics', label: 'Insights', Icon: BarChart2 },
];

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isStealth, setIsStealth] = useState(false);
    const [pipWindow, setPipWindow] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showResumeUpload, setShowResumeUpload] = useState(false);
    const [suggestions, setSuggestions] = useState("");
    const [lastTranscript, setLastTranscript] = useState("");
    const [connectionStatus, setConnectionStatus] = useState(socket.connected ? 'connected' : 'connecting');
    const [providerInfo, setProviderInfo] = useState({ hasOpenAI: false, hasGemini: false, isOnline: false });
    const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
    const [resumeLoaded, setResumeLoaded] = useState(false);
    const [ragDocuments, setRagDocuments] = useState([]);
    const [lastRagContext, setLastRagContext] = useState(null);
    const [currentScreenFrame, setCurrentScreenFrame] = useState(null);
    const [theme, setTheme] = useTheme();

    const handleTranscriptSent = useCallback((text) => {
        setLastTranscript(text);
        setIsLoadingAnswer(true);
        setLastRagContext(null);
    }, []);

    const openStealthPip = useCallback(async () => {
        if ('documentPictureInPicture' in window) {
            try {
                const pip = await window.documentPictureInPicture.requestWindow({ width: 360, height: 520 });
                [...document.head.querySelectorAll('style, link[rel="stylesheet"]')].forEach(el =>
                    pip.document.head.appendChild(el.cloneNode(true))
                );
                pip.document.body.style.margin = "0";
                pip.document.body.style.height = "100vh";
                pip.document.body.style.backgroundColor = "#0A0A0A";
                const rootDiv = pip.document.createElement('div');
                rootDiv.id = 'pip-root';
                rootDiv.style.height = "100%";
                pip.document.body.appendChild(rootDiv);
                pip.addEventListener('pagehide', () => {
                    setIsStealth(false);
                    setPipWindow(null);
                });
                setPipWindow(pip);
                setIsStealth(true);
            } catch (err) {
                console.error("PiP failed", err);
                setIsStealth(true);
            }
        } else {
            setIsStealth(true);
        }
    }, []);

    useEffect(() => {
        if (socket.connected) setConnectionStatus('connected');

        const onConnect = () => {
            setConnectionStatus('connected');
            socket.emit('requestSessionState');
            socket.emit('rag:listDocuments');
            const savedSettings = loadLocal(STORAGE_KEYS.settings, null);
            if (savedSettings) {
                socket.emit('updateSettings', savedSettings);
            }
        };

        const onDisconnect = () => {
            setConnectionStatus('disconnected');
        };

        const onConnectError = (err) => {
            console.warn("Socket Connection Error:", err.message);
            setConnectionStatus('error');
        };

        const onProviderStatus = (status) => {
            setProviderInfo(status || { hasOpenAI: false, hasGemini: false, isOnline: false });
        };

        const onAnswer = (text) => {
            setSuggestions(text);
            setIsLoadingAnswer(false);
        };

        const onAnswerChunk = (data) => {
            setIsLoadingAnswer(false);
            if (data.isFirst) {
                setSuggestions(data.chunk);
            } else {
                setSuggestions(prev => prev + data.chunk);
            }
        };

        const onResumeConfirmed = () => setResumeLoaded(true);

        const onSessionState = (state) => {
            if (state?.resumeLoaded) setResumeLoaded(true);
            if (Array.isArray(state?.documents)) {
                setRagDocuments(state.documents);
            }
        };

        const onRagDocumentsList = (docs) => {
            const list = Array.isArray(docs) ? docs : [];
            setRagDocuments(list);
            setResumeLoaded(list.some(d => d.docType === 'resume'));
        };

        const onRagContextUsed = (ctx) => {
            setLastRagContext(ctx || null);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('providerStatus', onProviderStatus);
        socket.on('answer', onAnswer);
        socket.on('answerChunk', onAnswerChunk);
        socket.on('resumeConfirmed', onResumeConfirmed);
        socket.on('sessionStateUpdate', onSessionState);
        socket.on('rag:documentsList', onRagDocumentsList);
        socket.on('rag:contextUsed', onRagContextUsed);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('providerStatus', onProviderStatus);
            socket.off('answer', onAnswer);
            socket.off('answerChunk', onAnswerChunk);
            socket.off('resumeConfirmed', onResumeConfirmed);
            socket.off('sessionStateUpdate', onSessionState);
            socket.off('rag:documentsList', onRagDocumentsList);
            socket.off('rag:contextUsed', onRagContextUsed);
        };
    }, []);

    useEffect(() => {
        const onHotkey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                setIsStealth(v => {
                    if (v && pipWindow) pipWindow.close();
                    return !v;
                });
            }
            if (e.key === 'Escape' && isStealth && !pipWindow) {
                setIsStealth(false);
            }
        };
        window.addEventListener('keydown', onHotkey);
        return () => window.removeEventListener('keydown', onHotkey);
    }, [isStealth, pipWindow]);

    const handleAnalyzeScreen = useCallback((frameData) => {
        if (!frameData) return;
        setLastTranscript("📸 Analyzing shared screen…");
        setIsLoadingAnswer(true);
        setLastRagContext(null);
        socket.emit('analyzeScreen', frameData);
    }, []);

    const copilotView = (
        <div className="flex flex-col lg:flex-row h-full overflow-hidden gap-6 p-6">
            <div className="w-full lg:w-[360px] flex flex-col gap-4 shrink-0 overflow-y-auto">
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-[13px] font-semibold tracking-tight">Live Copilot</h2>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                            connectionStatus === 'connected'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : connectionStatus === 'connecting'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-600'
                        }`}>
                            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
                        </span>
                    </div>
                    <div className="mb-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-mono border ${
                            providerInfo.isOnline
                                ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}>
                            {providerInfo.isOnline
                                ? `AI: ${providerInfo.hasOpenAI ? 'OpenAI' : 'Gemini'}`
                                : 'Offline FastEngine'}
                        </span>
                    </div>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        Speak, type, or share your screen. Get a clean, document-grounded answer instantly.
                    </p>
                </div>

                <ScreenWatcher
                    onFrameUpdate={setCurrentScreenFrame}
                    onAnalyzeScreen={handleAnalyzeScreen}
                />

                <div className="card p-5">
                    <SpeechInput
                        socket={socket}
                        onTranscript={handleTranscriptSent}
                        additionalContext={{ image: currentScreenFrame }}
                    />
                    <div className="mt-4 rounded-lg border p-3 min-h-[72px]" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <div className="text-[11px] font-medium tracking-wide uppercase" style={{ color: 'var(--text-faint)' }}>You said</div>
                        <p className="text-[13px] italic leading-relaxed mt-1" style={{ color: 'var(--text)' }}>{lastTranscript || "Waiting…"}</p>
                    </div>
                </div>

                <button
                    onClick={openStealthPip}
                    className="w-full py-3 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium hover:opacity-90 transition-opacity"
                >
                    <span>Open as floating window</span>
                    <span className="ml-2 text-[11px] opacity-60 hidden sm:inline">Hidden • Ctrl+Shift+H</span>
                </button>
            </div>

            <div className="flex-1 min-h-[420px] flex flex-col overflow-hidden">
                <SuggestionPanel
                    suggestions={suggestions}
                    loading={isLoadingAnswer}
                    onPopOut={openStealthPip}
                    ragContext={lastRagContext}
                    documentsCount={ragDocuments.length}
                    onManageDocs={() => setShowResumeUpload(true)}
                />
            </div>
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
            <Toaster />
            {isStealth && (
                <StealthOverlay
                    suggestions={suggestions}
                    pipWindow={pipWindow}
                    lastTranscript={lastTranscript}
                    ragContext={lastRagContext}
                    onClear={() => { setSuggestions(""); setLastTranscript(""); setLastRagContext(null); }}
                    onClose={() => { setIsStealth(false); if (pipWindow) pipWindow.close(); }}
                />
            )}
            {showSettings && <ToneSettings socket={socket} onClose={() => setShowSettings(false)} />}
            {showResumeUpload && (
                <ResumeUploader
                    socket={socket}
                    apiBaseUrl={API_BASE_URL}
                    documents={ragDocuments}
                    onClose={() => setShowResumeUpload(false)}
                />
            )}

            {!isStealth && (
                <div className="hidden md:flex w-[240px] shrink-0 flex-col border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="px-5 py-6 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] dark:bg-white flex items-center justify-center text-white dark:text-black font-semibold text-sm">◯</div>
                        <div className="flex-1">
                            <div className="text-[13px] font-semibold tracking-tight leading-none">Final Round</div>
                            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Prep Studio</div>
                        </div>
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="w-7 h-7 rounded-full border flex items-center justify-center"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        >
                            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                        </button>
                    </div>

                    <nav className="px-3 space-y-1">
                        {NAV.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-left transition-colors ${activeTab === item.id ? 'bg-[#0A0A0A] text-white dark:bg-white dark:text-black' : ''}`}
                                style={activeTab !== item.id ? { color: 'var(--text-muted)' } : {}}
                            >
                                <item.Icon size={16} />
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    <div className="mt-auto p-3 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
                        <div className="text-[11px] px-3 py-2 rounded-lg border space-y-1" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                            <div>{connectionStatus === 'connected' ? '● Engine online' : connectionStatus === 'connecting' ? '◐ Connecting...' : '○ Engine offline'}</div>
                            <div className="text-[10px] font-mono" style={{ color: providerInfo.isOnline ? '#3b82f6' : '#f59e0b' }}>
                                {providerInfo.isOnline ? `AI: ${providerInfo.hasOpenAI ? 'OpenAI' : 'Gemini'}` : 'Offline FastEngine'}
                            </div>
                        </div>
                        <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                            <Settings size={16} /> Settings
                        </button>
                        <button onClick={() => setShowResumeUpload(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                            <FileText size={16} /> Docs & RAG · {ragDocuments.length > 0 ? `${ragDocuments.length} Indexed` : resumeLoaded ? 'Ready' : 'Add'}
                        </button>
                    </div>
                </div>
            )}

            <div className={`flex-1 min-w-0 flex flex-col ${isStealth ? 'opacity-0 pointer-events-none' : ''}`}>
                <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
                    {activeTab === 'dashboard' && <Dashboard onStartMock={() => setActiveTab('mock')} onStartCopilot={() => setActiveTab('copilot')} onNavigate={(tab) => setActiveTab(tab)} />}
                    {activeTab === 'copilot' && copilotView}
                    {activeTab === 'code' && <div className="p-6 h-full"><CodeEditor /></div>}
                    {activeTab === 'resume' && <ResumeAnalyzer socket={socket} apiBaseUrl={API_BASE_URL} onExit={() => setActiveTab('dashboard')} />}
                    {activeTab === 'analytics' && <Analytics socket={socket} />}
                    {activeTab === 'mock' && <MockInterviewUI socket={socket} onExit={() => setActiveTab('dashboard')} />}
                </div>
            </div>

            {!isStealth && (
                <nav className="md:hidden fixed bottom-0 inset-x-0 border-t flex justify-around items-center p-2 z-50" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    {NAV.map(item => (
                        <button key={item.id} onClick={() => setActiveTab(item.id)} className={`p-2.5 rounded-lg ${activeTab === item.id ? 'bg-[#0A0A0A] text-white dark:bg-white dark:text-black' : ''}`} style={activeTab !== item.id ? { color: 'var(--text-muted)' } : {}}>
                            <item.Icon size={18} />
                        </button>
                    ))}
                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </nav>
            )}
        </div>
    );
}

export default App;
