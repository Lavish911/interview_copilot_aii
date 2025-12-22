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
    Menu
} from 'lucide-react';

// Components
// Components
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

// Connect to backend (Dynamic IP for Mobile/Network Access)
const SOCKET_URL = "https://interview-copilot-aii.onrender.com"; // Your Render URL
const API_BASE_URL = SOCKET_URL; // Use same URL for API calls
const socket = io(SOCKET_URL);

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isStealth, setIsStealth] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showResumeUpload, setShowResumeUpload] = useState(false);

    // Core Data
    const [suggestions, setSuggestions] = useState("");
    const [lastTranscript, setLastTranscript] = useState("");
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [resumeLoaded, setResumeLoaded] = useState(false);
    const [currentScreenFrame, setCurrentScreenFrame] = useState(null);

    useEffect(() => {
        // ... (existing effects keep as is via unchanged lines, but this tool replaces blocks. I should be careful)
        console.log("App mounted. Socket status:", socket.connected);
        if (socket.connected) setIsConnected(true);

        const onConnect = () => {
            console.log("Socket Connected!");
            setIsConnected(true);
        };

        const onDisconnect = () => {
            console.log("Socket Disconnected!");
            setIsConnected(false);
        };

        const onAnswer = (text) => {
            console.log("Received Answer:", text);
            setSuggestions(text);
        };

        const onResumeConfirmed = () => setResumeLoaded(true);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('answer', onAnswer);
        socket.on('resumeConfirmed', onResumeConfirmed);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('answer', onAnswer);
            socket.off('resumeConfirmed', onResumeConfirmed);
        };
    }, []);

    // Copilot View (The original "Main" view)
    const CopilotView = () => (
        <div className="flex h-full">
            {/* Left Control Panel */}
            <div className="w-1/3 p-6 border-r border-slate-800 flex flex-col gap-4">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-white mb-2">Live Copilot</h2>
                    <div className="flex items-center gap-2 mb-4">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-500'}`}></div>
                        <span className="text-xs text-slate-500 font-mono">
                            {isConnected ? "⚡ FAST ENGINE CONNECTED" : "OFFLINE"}
                        </span>
                    </div>
                </div>

                <ScreenWatcher onFrameUpdate={setCurrentScreenFrame} />

                <div className="flex-grow flex flex-col gap-4">
                    <SpeechInput
                        socket={socket}
                        onTranscript={setLastTranscript}
                        additionalContext={{ image: currentScreenFrame }}
                    />

                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex-grow overflow-y-auto min-h-[100px]">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Transcript</h3>
                        <p className="text-slate-300 text-sm italic">{lastTranscript || "Listening..."}</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsStealth(true)}
                    className="mt-auto w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <Ghost size={16} /> Enter Stealth Mode
                </button>
            </div>

            {/* Right Suggestion Panel */}
            <div className="flex-1 p-6 bg-slate-900/30">
                <SuggestionPanel suggestions={suggestions} />
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-[#0f1117] text-slate-300 font-sans overflow-hidden">
            {/* Stealth Overlay */}
            {isStealth && <StealthOverlay suggestions={suggestions} onClose={() => setIsStealth(false)} />}

            {/* Modals */}
            {showSettings && <ToneSettings socket={socket} onClose={() => setShowSettings(false)} />}
            {showResumeUpload && <ResumeUploader socket={socket} apiBaseUrl={API_BASE_URL} onClose={() => setShowResumeUpload(false)} />}

            {/* Main Sidebar */}
            {!isStealth && (
                <div className="w-20 lg:w-64 bg-[#161b22] border-r border-slate-800 flex flex-col justify-between transition-all duration-300">
                    <div>
                        {/* Logo */}
                        <div className="p-6 flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                                AI
                            </div>
                            <span className="hidden lg:block font-bold text-white tracking-tight">Final Round</span>
                        </div>

                        {/* Nav Items */}
                        <nav className="flex flex-col gap-2 px-3">
                            <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                            <NavItem icon={<Mic size={20} />} label="Interview Copilot" active={activeTab === 'copilot'} onClick={() => setActiveTab('copilot')} />
                            <NavItem icon={<Code size={20} />} label="Code Sandbox" active={activeTab === 'code'} onClick={() => setActiveTab('code')} />
                            <NavItem icon={<FileText size={20} />} label="Resume Strategy" active={activeTab === 'resume'} onClick={() => setActiveTab('resume')} />
                            <NavItem icon={<BarChart2 size={20} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
                            <NavItem icon={<Ghost size={20} />} label="Mock Interview" active={activeTab === 'mock'} onClick={() => setActiveTab('mock')} />
                        </nav>
                    </div>

                    {/* Bottom Actions */}
                    <div className="p-4 border-t border-slate-800">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center gap-3 w-full p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                            <Settings size={20} />
                            <span className="hidden lg:block text-sm">Settings</span>
                        </button>
                        <button
                            onClick={() => setShowResumeUpload(true)}
                            className="mt-2 flex items-center gap-3 w-full p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                            <FileText size={20} />
                            <span className="hidden lg:block text-sm">Context ({resumeLoaded ? 'Active' : 'Empty'})</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className={`flex-1 relative ${isStealth ? 'opacity-0 pointer-events-none' : ''}`}>
                {activeTab === 'dashboard' && <Dashboard onStartMock={() => setActiveTab('mock')} onStartCopilot={() => setActiveTab('copilot')} />}
                {activeTab === 'copilot' && <CopilotView />}
                {activeTab === 'code' && <div className="p-6 h-full"><CodeEditor /></div>}
                 {activeTab === 'resume' && <ResumeAnalyzer socket={socket} apiBaseUrl={API_BASE_URL} onExit={() => setActiveTab('dashboard')} />}
                {activeTab === 'analytics' && <Analytics socket={socket} />}
                {activeTab === 'mock' && <MockInterviewUI socket={socket} onExit={() => setActiveTab('dashboard')} />}
            </div>
        </div>
    );
}

const NavItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 group
        ${active ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/10 text-white border border-blue-500/30' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}
        `}
    >
        <div className={`${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
            {icon}
        </div>
        <span className="hidden lg:block text-sm font-medium">{label}</span>
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] hidden lg:block"></div>}
    </button>
);

export default App;
