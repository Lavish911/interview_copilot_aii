import React, { useEffect, useState, useRef, useCallback } from 'react';

const CORRECTIONS = {
    // Frontend
    "reacts": "React", "re act": "React", "type script": "TypeScript",
    "java script": "JavaScript", "view js": "Vue.js", "next js": "Next.js",
    "cs s": "CSS", "ht ml": "HTML", "tail wind": "Tailwind", "re ducks": "Redux",
    // Backend
    "notes js": "Node.js", "note js": "Node.js", "no js": "Node.js",
    "express js": "Express.js", "nest js": "NestJS", "spring boot": "Spring Boot",
    "jason": "JSON", "j son": "JSON", "a p i": "API", "graph q l": "GraphQL",
    // Databases
    "s q l": "SQL", "my sql": "MySQL", "post grass": "PostgreSQL", "post gress": "PostgreSQL",
    "no sequel": "NoSQL", "mongo db": "MongoDB", "mongo tv": "MongoDB", "mango db": "MongoDB",
    "red is": "Redis", "read is": "Redis",
    // DevOps & Cloud
    "cooper net is": "Kubernetes", "kuber netis": "Kubernetes", "cuban it is": "Kubernetes",
    "a w s": "AWS", "g c p": "GCP", "get hub": "GitHub", "git lab": "GitLab",
    "ci cd": "CI/CD", "c i c d": "CI/CD",
    // Core CS
    "d s a": "DSA", "b s a": "DSA", "big o": "Big O", "object oriented": "OOP",
    "c plus plus": "C++", "c sharp": "C#"
};

const SpeechInput = ({ socket, onTranscript, additionalContext = {} }) => {
    const [isListening, setIsListening] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [interimText, setInterimText] = useState("");
    const [manualQuery, setManualQuery] = useState("");

    const isMutedRef = useRef(isMuted);
    const isListeningRef = useRef(isListening);
    const silenceTimerRef = useRef(null);
    const lastProcessedRef = useRef({ text: "", at: 0 });
    const recognitionRef = useRef(null);
    const additionalContextRef = useRef(additionalContext);

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
    useEffect(() => { additionalContextRef.current = additionalContext; }, [additionalContext]);

    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const next = !prev;
            isMutedRef.current = next;
            if (next && silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
                setInterimText("");
            }
            return next;
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                toggleMute();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleMute]);

    const stopSpeechEngine = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onresult = null;
            try { recognitionRef.current.abort(); } catch { /* ignore */ }
            recognitionRef.current = null;
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        setInterimText("");
    }, []);

    useEffect(() => {
        return () => stopSpeechEngine();
    }, [stopSpeechEngine]);

    const handleSend = useCallback((rawText) => {
        if (!rawText || isMutedRef.current) return;

        let text = rawText.trim();
        if (!text) return;

        for (const [wrong, right] of Object.entries(CORRECTIONS)) {
            text = text.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), right);
        }

        const now = Date.now();
        const normText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        const prevNorm = (lastProcessedRef.current.normText || '');
        if (
            now - lastProcessedRef.current.at < 3500 &&
            (normText === prevNorm || (prevNorm.length >= 6 && normText.startsWith(prevNorm)))
        ) {
            return;
        }

        lastProcessedRef.current = { text, normText, at: now };
        setInterimText("");
        onTranscript(text);

        socket.emit('question', {
            transcript: text,
            ...additionalContextRef.current
        });
        socket.emit('analyzeSpeech', text);
    }, [socket, onTranscript]);

    const startSpeechEngine = useCallback(() => {
        stopSpeechEngine();

        if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            setErrorMessage("⚠️ Browser not supported. Use Chrome or Edge.");
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

            if (finalTranscript) {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                handleSend(finalTranscript);
                return;
            }

            if (interimTranscript.trim().length > 0) {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    if (!isMutedRef.current) {
                        handleSend(interimTranscript);
                        if (recognitionRef.current) {
                            try { recognitionRef.current.abort(); } catch { /* ignore */ }
                        }
                    }
                }, 2000);
            }
        };

        recognition.onend = () => {
            if (isListeningRef.current) {
                setTimeout(() => {
                    if (isListeningRef.current) startSpeechEngine();
                }, 100);
            }
        };

        recognition.onerror = (event) => {
            if (['not-allowed', 'service-not-allowed'].includes(event.error)) {
                setErrorMessage("⚠️ Access Denied. Allow Mic.");
                setIsListening(false);
                isListeningRef.current = false;
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
    }, [stopSpeechEngine, handleSend]);

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
                    setErrorMessage(
                        err.name === 'NotAllowedError'
                            ? "⚠️ Mic blocked — click the lock icon → Allow microphone, then try again."
                            : `⚠️ Mic error: ${err.message}`
                    );
                    return;
                }
            }
            setIsListening(true);
            isListeningRef.current = true;
            startSpeechEngine();
        }
    };

    // Clipboard Image Paste Support
    useEffect(() => {
        const handlePaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        onTranscript("📸 Analyzing screenshot...");
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
        <div className="relative w-full">
            {errorMessage && (
                <div className="mb-3 border text-xs font-medium px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.2)', color: '#DC2626' }}>
                    {errorMessage}
                </div>
            )}

            {isListening && !isMuted && (
                <div className="mb-3 min-h-[24px] flex items-center justify-center">
                    {interimText ? (
                        <p className="text-xs px-2.5 py-1 rounded-full border truncate max-w-full" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                            “{interimText.slice(-48)}”
                        </p>
                    ) : (
                        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Listening… speak now</span>
                    )}
                </div>
            )}

            <div className="flex items-center justify-center gap-2 mb-3 text-[11px] tracking-wide uppercase" style={{ color: 'var(--text-faint)' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-emerald-500' : 'bg-[#D4D4D4]'}`} />
                {isListening ? 'Mic on' : 'Mic off'}
                <span>·</span>
                {isMuted ? 'Paused' : 'Active'}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={toggleListening}
                    className={`flex-1 py-2.5 rounded-lg text-[13px] font-medium border transition-colors ${isListening ? '' : 'bg-[#0A0A0A] dark:bg-white text-white dark:text-black border-[#0A0A0A] dark:border-white'}`}
                    style={isListening ? { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' } : {}}
                >
                    {isListening ? 'Stop' : 'Start listening'}
                </button>

                {isListening && (
                    <button
                        onClick={toggleMute}
                        className={`flex-1 py-2.5 rounded-lg text-[13px] font-medium border ${isMuted ? 'bg-[#0A0A0A] dark:bg-white text-white dark:text-black border-[#0A0A0A]' : ''}`}
                        style={!isMuted ? { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' } : {}}
                    >
                        {isMuted ? 'Resume' : 'Pause'}
                    </button>
                )}
            </div>

            <p className="mt-2 text-[11px] text-center" style={{ color: 'var(--text-faint)' }}>
                Press <span className="px-1 py-0.5 rounded border text-[11px]" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>Space</span> to pause/resume
            </p>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!manualQuery.trim()) return;
                    handleSend(manualQuery.trim());
                    setManualQuery("");
                }}
                className="mt-3 pt-3 border-t flex gap-2"
                style={{ borderColor: 'var(--border)' }}
            >
                <input
                    type="text"
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    placeholder="Or type a question to query RAG / AI…"
                    className="flex-1 rounded-lg border px-3 py-2 text-xs"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
                <button
                    type="submit"
                    disabled={!manualQuery.trim()}
                    className="px-3 py-2 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-xs font-medium disabled:opacity-40"
                >
                    Ask
                </button>
            </form>
        </div>
    );
};

export default SpeechInput;
