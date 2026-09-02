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

    const toggleListening = async () => {
        setErrorMessage("");

        if (window.location.hostname !== 'localhost' && window.location.protocol === 'http:') {
            setErrorMessage("⚠️ HTTPS Required for Mic on Network! Use localhost or HTTPS.");
            return;
        }

        if (isListening) {
            setIsListening(false);
            isListeningRef.current = false;
            stopSpeechEngine();
        } else {
            if (navigator.mediaDevices?.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                } catch (err) {
                    setErrorMessage(err.name === 'NotAllowedError' ? "⚠️ Mic blocked — click the lock icon → Allow microphone, then try again." : `⚠️ Mic error: ${err.message}`);
                    return;
                }
            }
            setIsListening(true);
            isListeningRef.current = true;
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
        <div className="card p-4 relative w-full">
            {errorMessage && (
                <div className="mb-3 border text-xs font-medium px-3 py-2 rounded-lg" style={{ background:'rgba(220,38,38,0.08)', borderColor:'rgba(220,38,38,0.2)', color:'#DC2626'}}>
                    {errorMessage}
                </div>
            )}

            {isListening && !isMuted && (
                <div className="mb-3 min-h-[24px] flex items-center justify-center">
                    {interimText ? (
                        <p className="text-xs px-2.5 py-1 rounded-full border truncate max-w-full" style={{ background:'var(--surface-2)', borderColor:'var(--border)', color:'var(--text)'}}>
                            “{interimText.slice(-48)}”
                        </p>
                    ) : (
                        <span className="text-xs" style={{ color:'var(--text-faint)'}}>Listening… speak now</span>
                    )}
                </div>
            )}

            <div className="flex items-center justify-center gap-2 mb-3 text-[11px] tracking-wide uppercase" style={{ color:'var(--text-faint)'}}>
                <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-emerald-500' : 'bg-[#D4D4D4]'}`} />
                {isListening ? 'Mic on' : 'Mic off'}
                <span>·</span>
                {isMuted ? 'Paused' : 'Active'}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={toggleListening}
                    className={`flex-1 py-2.5 rounded-lg text-[13px] font-medium border transition-colors ${isListening ? '' : 'bg-[#0A0A0A] dark:bg-white text-white dark:text-black border-[#0A0A0A] dark:border-white'}`}
                    style={isListening ? { background:'var(--surface-2)', borderColor:'var(--border)', color:'var(--text)'} : {}}
                >
                    {isListening ? 'Stop' : 'Start listening'}
                </button>

                {isListening && (
                    <button
                        onClick={toggleMute}
                        className={`flex-1 py-2.5 rounded-lg text-[13px] font-medium border ${isMuted ? 'bg-[#0A0A0A] dark:bg-white text-white dark:text-black border-[#0A0A0A]' : ''}`}
                        style={!isMuted ? { background:'var(--surface)', borderColor:'var(--border)', color:'var(--text)'} : {}}
                    >
                        {isMuted ? 'Resume' : 'Pause'}
                    </button>
                )}
            </div>

            <p className="mt-2 text-[11px] text-center" style={{ color:'var(--text-faint)'}}>
                Press <span className="px-1 py-0.5 rounded border text-[11px]" style={{ background:'var(--surface-2)', borderColor:'var(--border)'}}>Space</span> to pause/resume
            </p>
        </div>
    );
};

export default SpeechInput;
