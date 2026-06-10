import React, { useEffect, useState, useRef } from 'react';

const SpeechInput = ({ socket, onTranscript, additionalContext = {} }) => {
    const [isListening, setIsListening] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [interimText, setInterimText] = useState("");

    // Refs
    const isMutedRef = useRef(isMuted);
    const isListeningRef = useRef(isListening);
    // Timer to trigger "Turbo Send" if user pauses
    const silenceTimerRef = useRef(null);
    // Dedup ref to prevent double sending
    const lastProcessedTextRef = useRef("");
    // Hold the active recognition object
    const recognitionRef = useRef(null);

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

    // Spacebar Hotkey
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                toggleMute();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => stopSpeechEngine();
    }, []);

    const startSpeechEngine = () => {
        // ALWAYS cleanup first to ensure fresh state
        stopSpeechEngine();

        if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            setErrorMessage("⚠️ Browser not supported. Use Chrome.");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            setErrorMessage("");
            if (isMutedRef.current) return;

            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            setInterimText(interimTranscript || finalTranscript);

            // LOGIC 1: Final Event (Standard)
            if (finalTranscript) {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                handleSend(finalTranscript);
                return;
            }

            // LOGIC 2: Turbo Silence Trigger (>400ms)
            // If we have interim text but no final result for 400ms, assume speech ended.
            if (interimTranscript.trim().length > 0) {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    console.log("⚡ Silence detected. Force sending...");
                    handleSend(interimTranscript);
                }, 250);
            }
        };

        recognition.onend = () => {
            // Only restart if the USER wants it to be listening
            // We use 'isListeningRef' to check intended state.
            if (isListeningRef.current) {
                console.log("🔄 Auto-restarting microphone...");
                // Re-call startSpeechEngine to get a clean instance
                // Small delay to prevent CPU spinning if errors occur
                setTimeout(() => {
                    startSpeechEngine();
                }, 100);
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech error", event.error);
            if (['not-allowed', 'service-not-allowed'].includes(event.error)) {
                setErrorMessage("⚠️ Access Denied. Allow Mic.");
                setIsListening(false);
                isListeningRef.current = false; // Sync ref immediately
            } else if (event.error === 'network') {
                setErrorMessage("⚠️ Network/Connection Error.");
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch (e) {
            console.error("Start error:", e);
        }
    };

    const stopSpeechEngine = () => {
        if (recognitionRef.current) {
            // Remove listeners to prevent zombie callbacks firing after we stopped
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onresult = null;
            try { recognitionRef.current.abort(); } catch (e) { } // Abort is faster/cleaner than stop
            recognitionRef.current = null;
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setInterimText("");
    };

    const handleSend = (rawText) => {
        if (!rawText) return;

        // Auto-correct common technical jargon that STT mishears
        const corrections = {
            // Frontend
            "reacts": "React", "re act": "React", "type script": "TypeScript", 
            "java script": "JavaScript", "view js": "Vue.js", "next js": "Next.js",
            "cs s": "CSS", "ht ml": "HTML", "tail wind": "Tailwind", "re ducks": "Redux",
            // Backend
            "notes js": "Node.js", "notice": "Node.js", "note js": "Node.js", "no js": "Node.js",
            "express js": "Express.js", "nest js": "NestJS", "spring boot": "Spring Boot",
            "jason": "JSON", "j son": "JSON", "a p i": "API", "graph q l": "GraphQL",
            // Databases
            "s q l": "SQL", "my sql": "MySQL", "post grass": "PostgreSQL", "post gress": "PostgreSQL",
            "mongo db": "MongoDB", "mongo tv": "MongoDB", "mango db": "MongoDB",
            "red is": "Redis", "read is": "Redis",
            // DevOps & Cloud
            "cooper net is": "Kubernetes", "kuber netis": "Kubernetes", "cuban it is": "Kubernetes",
            "doctor": "Docker", "a w s": "AWS", "g c p": "GCP", "get hub": "GitHub", "git lab": "GitLab",
            "ci cd": "CI/CD", "c i c d": "CI/CD",
            // Core CS
            "d s a": "DSA", "b s a": "DSA", "big o": "Big O", "object oriented": "OOP",
            "c plus plus": "C++", "c sharp": "C#"
        };
        let text = rawText;
        for (const [wrong, right] of Object.entries(corrections)) {
            text = text.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), right);
        }

        if (text === lastProcessedTextRef.current) return;

        console.log("🚀 Send:", text);
        lastProcessedTextRef.current = text;
        setInterimText("");
        onTranscript(text);

        const payload = {
            transcript: text,
            ...additionalContext
        };
        socket.emit('question', payload);
        socket.emit('analyzeSpeech', text);

        // IMPORTANT: We do NOT stop the engine here. 
        // We let 'continuous' keep running or let 'onend' restart it.
    };

    const toggleListening = () => {
        setErrorMessage("");

        if (window.location.hostname !== 'localhost' && window.location.protocol === 'http:') {
            setErrorMessage("⚠️ HTTPS Required for Mic on Network!");
            return;
        }

        if (isListening) {
            // Turning OFF
            setIsListening(false);
            isListeningRef.current = false; // Sync immediately
            stopSpeechEngine();
        } else {
            // Turning ON
            setIsListening(true);
            isListeningRef.current = true; // Sync immediately
            startSpeechEngine();
        }
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
    };

    // Paste Support
    useEffect(() => {
        const handlePaste = (e) => {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        onTranscript("📸 analyzing screenshot...");
                        socket.emit('question', { transcript: "", image: event.target.result });
                    };
                    reader.readAsDataURL(blob);
                    e.preventDefault();
                    break;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [socket, onTranscript]);

    return (
        <div className="flex flex-col items-center p-4 bg-slate-800 rounded-lg shadow-lg relative w-full">
            {errorMessage && (
                <div className="absolute -top-10 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded animate-bounce z-50">
                    {errorMessage}
                </div>
            )}

            {/* Turbo Text Visual */}
            {isListening && !isMuted && (
                <div className="mb-2 h-6 w-full text-center">
                    {interimText ? (
                        <p className="text-cyan-400 text-xs font-mono animate-pulse truncate px-4">
                            "...{interimText.slice(-40)}"
                        </p>
                    ) : (
                        <div className="flex justify-center gap-1 h-full items-center">
                            <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce delay-0"></div>
                            <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce delay-150"></div>
                        </div>
                    )}
                </div>
            )}

            {/* Status Icons */}
            <div className="flex gap-4 mb-3">
                <div className={`w-4 h-4 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} title="Mic Power"></div>
                <div className={`w-4 h-4 rounded-full ${isMuted ? 'bg-yellow-500' : 'bg-transparent border border-gray-500'}`} title="Input Ignored"></div>
            </div>

            <div className="flex gap-2">
                {/* Main Power Button */}
                <button
                    onClick={toggleListening}
                    className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${isListening
                        ? 'bg-red-900/50 hover:bg-red-900 text-red-100 border border-red-500'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                >
                    {isListening ? 'OFF' : 'Power ON'}
                </button>

                {/* Mute Toggle */}
                {isListening && (
                    <button
                        onClick={toggleMute}
                        className={`px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${isMuted
                            ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                            : 'bg-slate-700 hover:bg-slate-600 text-gray-200 border border-slate-500'
                            }`}
                    >
                        {isMuted ? '🤐 PAUSED (Reading)' : '👂 Listening'}
                    </button>
                )}
            </div>

            <p className="mt-3 text-xs text-gray-400 text-center">
                {isMuted
                    ? '⚠️ INPUT IGNORED. Read your answer now.'
                    : isListening ? 'Listening (Turbo Mode)...' : 'Mic is Off'}
                <br />
                <span className="opacity-50">(hit SPACE to toggle)</span>
            </p>
        </div>
    );
};

export default SpeechInput;
