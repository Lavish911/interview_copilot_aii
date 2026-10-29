import React, { useEffect, useState, useRef, useCallback } from 'react';

const PHRASE_CORRECTIONS = [
    // Frontend & JS/TS
    [/\b(we act|re act|reacts|react j s|react js)\b/gi, "React"],
    [/\b(virtual dorm|virtual don|virtual d o m)\b/gi, "Virtual DOM"],
    [/\b(d o m)\b/gi, "DOM"],
    [/\b(you state|used state|use state)\b/gi, "useState"],
    [/\b(used effect|user fact|use effect)\b/gi, "useEffect"],
    [/\b(use memo|used memo)\b/gi, "useMemo"],
    [/\b(use call back|used callback)\b/gi, "useCallback"],
    [/\b(type script|tight script|typescripts)\b/gi, "TypeScript"],
    [/\b(java script|javascripts)\b/gi, "JavaScript"],
    [/\b(view js|vue j s|view j s)\b/gi, "Vue.js"],
    [/\b(next js|next j s)\b/gi, "Next.js"],
    [/\b(cs s|c s s)\b/gi, "CSS"],
    [/\b(ht ml|h t m l)\b/gi, "HTML"],
    [/\b(tail wind|tailwind c s s)\b/gi, "Tailwind CSS"],
    [/\b(re ducks|read ux)\b/gi, "Redux"],
    // Backend & Runtime
    [/\b(notes js|note js|no js|node j s|know js)\b/gi, "Node.js"],
    [/\b(even loop|event luke)\b/gi, "Event Loop"],
    [/\b(express js|express j s)\b/gi, "Express.js"],
    [/\b(nest js|nest j s)\b/gi, "NestJS"],
    [/\b(spring boot|spring boat)\b/gi, "Spring Boot"],
    [/\b(fast a p i|fast api)\b/gi, "FastAPI"],
    [/\b(rest a p i|rest api|breast api|west api)\b/gi, "REST API"],
    [/\b(a p i|a p eyes)\b/gi, "API"],
    [/\b(graph q l|graph ql|giraffe ql)\b/gi, "GraphQL"],
    [/\b(jason|j son)\b/gi, "JSON"],
    [/\b(web socket|web sockets|wet socket)\b/gi, "WebSockets"],
    [/\b(g r p c)\b/gi, "gRPC"],
    [/\b(a sink|a synchronous)\b/gi, "async"],
    [/\b(close sure|closures|closure)\b/gi, "closure"],
    // Databases & Caching
    [/\b(no sequel|no s q l)\b/gi, "NoSQL"],
    [/\b(my sequel|my s q l|my sql)\b/gi, "MySQL"],
    [/\b(post grass|post gress|post gres|postgres q l)\b/gi, "PostgreSQL"],
    [/\b(s q l|sequel)\b/gi, "SQL"],
    [/\b(mongo db|mongo tv|mango db)\b/gi, "MongoDB"],
    [/\b(red is|read is|reddish)\b/gi, "Redis"],
    [/\b(cash invalidation)\b/gi, "cache invalidation"],
    [/\b(cashing)\b/gi, "caching"],
    [/\b(data sharting|sharting)\b/gi, "sharding"],
    // DevOps, Cloud & Architecture
    [/\b(cooper net is|cooper netties|kuber netis|cuban it is|k 8 s)\b/gi, "Kubernetes"],
    [/\b(micro service|micro services)\b/gi, "microservices"],
    [/\b(sister design|system designed)\b/gi, "system design"],
    [/\b(low balancer|load balance)\b/gi, "load balancer"],
    [/\b(great limiter|rate limit)\b/gi, "rate limiter"],
    [/\b(cap theorem|cat theorem|cab theorem)\b/gi, "CAP theorem"],
    [/\b(i dem potent|item potent)\b/gi, "idempotent"],
    [/\b(a w s)\b/gi, "AWS"],
    [/\b(g c p)\b/gi, "GCP"],
    [/\b(get hub|git hub)\b/gi, "GitHub"],
    [/\b(git lab)\b/gi, "GitLab"],
    [/\b(ci cd|c i c d|see i see d)\b/gi, "CI/CD"],
    [/\b(jay w t|j w t)\b/gi, "JWT"],
    [/\b(oh auth|o auth)\b/gi, "OAuth"],
    [/\b(h t t p s)\b/gi, "HTTPS"],
    [/\b(h t t p)\b/gi, "HTTP"],
    [/\b(t c p)\b/gi, "TCP"],
    [/\b(u d p)\b/gi, "UDP"],
    [/\b(d n s)\b/gi, "DNS"],
    [/\b(c d n)\b/gi, "CDN"],
    // CS & Algorithms
    [/\b(d s a|b s a)\b/gi, "DSA"],
    [/\b(big o|big oh)\b/gi, "Big O"],
    [/\b(lead code|leet code)\b/gi, "LeetCode"],
    [/\b(object oriented|o o p)\b/gi, "OOP"],
    [/\b(c plus plus)\b/gi, "C++"],
    [/\b(c sharp)\b/gi, "C#"],
    [/\b(dead lock)\b/gi, "deadlock"],
    [/\b(raise condition)\b/gi, "race condition"]
];

const NON_QUESTION_CHATTER = new Set([
    "ok", "okay", "yeah", "yes", "yep", "no", "nope", "right", "sure",
    "got it", "makes sense", "i see", "thank you", "thanks", "thanks a lot",
    "uh", "um", "hmm", "hm", "ah", "oh", "well", "so", "like", "you know",
    "one second", "hold on", "let me think", "can you hear me", "am i audible",
    "is my screen visible", "good morning", "good afternoon", "good evening",
    "nice to meet you", "bye", "goodbye"
]);

const KNOWN_SINGLE_WORD_TOPICS = new Set([
    "react", "redux", "typescript", "javascript", "node.js", "nodejs", "sql",
    "nosql", "postgresql", "mongodb", "redis", "kubernetes", "docker",
    "microservices", "graphql", "websockets", "closure", "closures", "promises",
    "async", "caching", "sharding", "deadlock", "oop", "dsa", "jwt", "oauth",
    "css", "html", "flexbox", "rest", "api", "aws", "ci/cd", "weakness", "strengths"
]);

function cleanSpeechTranscript(rawText = "") {
    if (!rawText || typeof rawText !== "string") return "";
    let text = rawText.trim();
    if (!text) return "";

    // Strip leading conversational filler words from microphone speech
    text = text.replace(/^(?:(?:um+|uh+|hmm+|er+|ah+|oh+|like|you know|i mean|so yeah|okay so|alright so|well|so|okay|alright)[,\s]+)+/i, "").trim();

    for (const [pattern, replacement] of PHRASE_CORRECTIONS) {
        text = text.replace(pattern, replacement);
    }

    // Contextual fix for "cash" -> "cache" when near technical terms
    if (/\b(redis|database|memory|server|browser|cdn|api|query|data|hit|miss|layer|invalidat|ttl|store|system|design|scale|latency)\b/i.test(text)) {
        text = text.replace(/\bcash\b/gi, "cache");
    }

    // Collapse repeated consecutive words often caused by STT stutter ("what is what is" -> "what is")
    text = text.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");
    text = text.replace(/\s+/g, " ").trim();

    if (text.length > 0) {
        text = text.charAt(0).toUpperCase() + text.slice(1);
    }
    return text;
}

function isMeaningfulInterviewQuery(cleanedText, fromMic = false) {
    if (!cleanedText) return false;
    const norm = cleanedText.toLowerCase().replace(/[^a-z0-9.#+\s/-]/g, "").replace(/\s+/g, " ").trim();
    if (!norm) return false;

    if (fromMic && NON_QUESTION_CHATTER.has(norm)) {
        return false;
    }

    const words = norm.split(" ").filter(Boolean);
    if (fromMic && words.length < 2 && !KNOWN_SINGLE_WORD_TOPICS.has(words[0])) {
        return false;
    }
    return true;
}

const SpeechInput = ({ socket, onTranscript, additionalContext = {} }) => {
    const [isListening, setIsListening] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [interimText, setInterimText] = useState("");
    const [lastHeardText, setLastHeardText] = useState("");
    const [manualQuery, setManualQuery] = useState("");

    const isMutedRef = useRef(isMuted);
    const isListeningRef = useRef(isListening);
    const silenceTimerRef = useRef(null);
    const finalBufferRef = useRef("");
    const lastProcessedRef = useRef({ text: "", normText: "", at: 0 });
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
                finalBufferRef.current = "";
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
        finalBufferRef.current = "";
        setInterimText("");
    }, []);

    useEffect(() => {
        return () => stopSpeechEngine();
    }, [stopSpeechEngine]);

    const handleSend = useCallback((rawText, { fromMic = false } = {}) => {
        if (!rawText || (fromMic && isMutedRef.current)) return;

        const text = cleanSpeechTranscript(rawText);
        if (!isMeaningfulInterviewQuery(text, fromMic)) {
            setInterimText("");
            return;
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
        finalBufferRef.current = "";
        setInterimText("");
        setLastHeardText(text);
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
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            setErrorMessage("");
            if (isMutedRef.current) return;

            let finalChunk = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalChunk += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalChunk.trim()) {
                finalBufferRef.current = `${finalBufferRef.current} ${finalChunk}`.replace(/\s+/g, ' ').trim();
            }

            const combinedPreview = cleanSpeechTranscript(
                `${finalBufferRef.current} ${interimTranscript}`.trim()
            );
            setInterimText(combinedPreview);

            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }

            // Wait briefly (850ms after a final clause, or 1750ms after interim speech)
            // so multi-clause questions aren't cut off mid-sentence.
            const waitMs = finalBufferRef.current && !interimTranscript.trim() ? 850 : 1750;
            silenceTimerRef.current = setTimeout(() => {
                if (isMutedRef.current) return;
                const toSend = `${finalBufferRef.current} ${interimTranscript}`.replace(/\s+/g, ' ').trim();
                finalBufferRef.current = "";
                if (toSend) {
                    handleSend(toSend, { fromMic: true });
                }
            }, waitMs);
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

            {lastHeardText && (
                <div
                    className="mt-2.5 px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-[11px]"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                    <span className="truncate" title={lastHeardText}>
                        Heard: <strong style={{ color: 'var(--text)' }}>“{lastHeardText}”</strong>
                    </span>
                    <button
                        type="button"
                        onClick={() => setManualQuery(lastHeardText)}
                        className="shrink-0 underline hover:opacity-80 font-medium"
                        style={{ color: 'var(--text)' }}
                    >
                        Edit
                    </button>
                </div>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!manualQuery.trim()) return;
                    handleSend(manualQuery.trim(), { fromMic: false });
                    setManualQuery("");
                }}
                className="mt-3 pt-3 border-t flex gap-2"
                style={{ borderColor: 'var(--border)' }}
            >
                <input
                    type="text"
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    placeholder="Or type / edit a question to ask…"
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
