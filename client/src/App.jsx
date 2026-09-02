import React, { useState, useEffect } from 'react';
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

const SOCKET_URL = import.meta.env.DEV ? "http://localhost:3000" : "https://interview-copilot-aii.onrender.com";
const API_BASE_URL = SOCKET_URL;
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
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [resumeLoaded, setResumeLoaded] = useState(false);
    const [currentScreenFrame, setCurrentScreenFrame] = useState(null);
    const [theme, setTheme] = useTheme();

    useEffect(() => {
        if (socket.connected) setIsConnected(true);
        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        const onAnswer = (text) => setSuggestions(text);
        const onAnswerChunk = (data) => {
            if (data.isFirst) setSuggestions(data.chunk);
            else setSuggestions(prev => prev + data.chunk);
        };
        const onResumeConfirmed = () => setResumeLoaded(true);
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('answer', onAnswer);
        socket.on('answerChunk', onAnswerChunk);
        socket.on('resumeConfirmed', onResumeConfirmed);
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('answer', onAnswer);
            socket.off('answerChunk', onAnswerChunk);
            socket.off('resumeConfirmed', onResumeConfirmed);
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

    const copilotView = (
        <div className="flex flex-col lg:flex-row h-full overflow-hidden gap-6 p-6">
            <div className="w-full lg:w-[360px] flex flex-col gap-4 shrink-0 overflow-y-auto">
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-[13px] font-semibold tracking-tight">Live Copilot</h2>
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-full border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-600'}`}>
                            {isConnected ? 'Live' : 'Offline'}
                        </span>
                    </div>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>Speak or share your screen. Get a clean answer instantly.</p>
                </div>

                <ScreenWatcher onFrameUpdate={setCurrentScreenFrame} />

                <div className="card p-5">
                    <SpeechInput socket={socket} onTranscript={setLastTranscript} additionalContext={{ image: currentScreenFrame }} />
                    <div className="mt-4 rounded-lg border p-3 min-h-[72px]" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <div className="text-[11px] font-medium tracking-wide uppercase" style={{ color: 'var(--text-faint)' }}>You said</div>
                        <p className="text-[13px] italic leading-relaxed mt-1" style={{ color: 'var(--text)' }}>{lastTranscript || "Waiting…"}</p>
                    </div>
                </div>

                <button
                    onClick={async () => {
                        if ('documentPictureInPicture' in window) {
                            try {
                                const pip = await window.documentPictureInPicture.requestWindow({ width: 360, height: 520 });
                                ;[...document.head.querySelectorAll('style, link[rel="stylesheet"]')].forEach(el => pip.document.head.appendChild(el.cloneNode(true)));
                                pip.document.body.style.margin = "0"; pip.document.body.style.height = "100vh"; pip.document.body.style.backgroundColor = "#0A0A0A";
                                const rootDiv = pip.document.createElement('div'); rootDiv.id = 'pip-root'; rootDiv.style.height = "100%"; pip.document.body.appendChild(rootDiv);
                                pip.addEventListener('pagehide', () => { setIsStealth(false); setPipWindow(null); });
                                setPipWindow(pip); setIsStealth(true);
                            } catch { setIsStealth(true); }
                        } else setIsStealth(true);
                    }}
                    className="w-full py-3 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium hover:opacity-90 transition-opacity"
                >
                    <span>Open as floating window</span>
                    <span className="ml-2 text-[11px] opacity-60 hidden sm:inline">Hidden • Ctrl+Shift+H</span>
                </button>
            </div>

            <div className="flex-1 min-h-[420px] card overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <span className="font-medium">AI Answer</span>
                    <span>Streams as you speak</span>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                    <SuggestionPanel suggestions={suggestions} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
            <Toaster />
            {isStealth && <StealthOverlay suggestions={suggestions} pipWindow={pipWindow} lastTranscript={lastTranscript} onClear={() => { setSuggestions(""); setLastTranscript(""); }} onClose={() => { setIsStealth(false); if (pipWindow) pipWindow.close(); }} />}
            {showSettings && <ToneSettings socket={socket} onClose={() => setShowSettings(false)} />}
            {showResumeUpload && <ResumeUploader socket={socket} apiBaseUrl={API_BASE_URL} onClose={() => setShowResumeUpload(false)} />}

            {!isStealth && (
                <div className="hidden md:flex w-[240px] shrink-0 flex-col border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="px-5 py-6 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] dark:bg-white flex items-center justify-center text-white dark:text-black font-semibold text-sm">◯</div>
                        <div className="flex-1">
                            <div className="text-[13px] font-semibold tracking-tight leading-none">Final Round</div>
                            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Prep Studio</div>
                        </div>
                        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
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
                        <div className="text-[11px] px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                            {isConnected ? '● Engine online' : '○ Engine offline'}
                        </div>
                        <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                            <Settings size={16} /> Settings
                        </button>
                        <button onClick={() => setShowResumeUpload(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                            <FileText size={16} /> Resume · {resumeLoaded ? 'Ready' : 'Add'}
                        </button>
                    </div>
                </div>
            )}

            <div className={`flex-1 min-w-0 flex flex-col ${isStealth ? 'opacity-0 pointer-events-none' : ''}`}>
                <div className="flex-1 overflow-y-auto">
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
