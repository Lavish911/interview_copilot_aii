import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const MockInterviewUI = ({ socket, onExit }) => {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [loading, setLoading] = useState(false);

    // Speech Recognition Setup (Simpler inline version for this component)
    useEffect(() => {
        // ... reuse speech logic or pass from props? Let's use simple inline for isolation
        // Or better, let user type or speak.
    }, []);

    const startInterview = () => {
        setLoading(true);
        socket.emit('startMockInterview');
    };

    const submitAnswer = () => {
        setLoading(true);
        socket.emit('submitMockAnswer', { question, answer });
    };

    const nextQuestion = () => {
        setFeedback(null);
        setAnswer("");
        setLoading(true);
        socket.emit('startMockInterview');
    };

    // TTS Helper
    const speakText = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop previous
            const utterance = new SpeechSynthesisUtterance(text);
            // Select a good voice if available
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices[0];
            if (preferredVoice) utterance.voice = preferredVoice;
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    };

    useEffect(() => {
        socket.on('mockQuestion', (q) => {
            setQuestion(q);
            setLoading(false);
            speakText(q); // Speak the question!
        });

        socket.on('mockFeedback', (data) => {
            console.log("Client received mockFeedback DIRECTLY:", data);

            // Force state update with a small timeout to ensure React catches it
            setTimeout(() => {
                if (!data) {
                    console.error("Received null data!");
                    setFeedback({ score: 0, feedback: "Error: No data received", betterAnswer: "N/A" });
                } else {
                    setFeedback(data);
                }
                setLoading(false);
            }, 100);

            // Optional: Speak the score
            if (data && data.score) speakText(`I give that a ${data.score} out of 10.`);
        });

        return () => {
            socket.off('mockQuestion');
            socket.off('mockFeedback');
            window.speechSynthesis.cancel();
        };
    }, [socket]);

    return (
        <div className="flex flex-col h-full p-6 bg-slate-900 text-slate-200">
            <header className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                    Mock Interview Mode
                </h2>
                <button onClick={onExit} className="text-slate-400 hover:text-white px-3 py-1 border border-slate-700 rounded">
                    Exit to Copilot
                </button>
            </header>

            {!question ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center">
                    <p className="mb-4 text-slate-400">Ready to test your skills?</p>
                    <button
                        onClick={startInterview}
                        disabled={loading}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold shadow-lg transition-transform hover:scale-105"
                    >
                        {loading ? "Generating..." : "Start Interview Simulator"}
                    </button>
                </div>
            ) : (
                <div className="flex-grow flex flex-col gap-6 overflow-y-auto">
                    {/* Question Card */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 block">Interviewer Asks:</span>
                        <h3 className="text-xl font-medium text-white">{question}</h3>
                    </div>

                    {/* Answer Area */}
                    <div className="flex-grow flex flex-col">
                        <textarea
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Type your answer here (or speak)..."
                            className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-300 focus:border-blue-500 outline-none mb-4"
                        />
                        {!feedback && (
                            <button
                                onClick={submitAnswer}
                                disabled={loading || !answer}
                                className={`w-full py-3 rounded-lg font-bold transition-all ${loading ? 'bg-gray-700' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                            >
                                {loading ? "AI is Analyzing..." : "Submit Answer"}
                            </button>
                        )}
                    </div>

                    {/* Feedback Card */}
                    {feedback && (
                        <div className="bg-slate-900/80 border border-green-900/50 p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-lg font-bold text-green-400">AI Feedback</h4>
                                <div className="text-2xl font-black text-white bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                    {feedback.score}/10
                                </div>
                            </div>
                            <p className="text-slate-300 mb-4">{feedback.feedback}</p>

                            <div className="bg-slate-950 p-4 rounded border border-slate-800">
                                <span className="text-xs text-purple-400 font-bold uppercase block mb-1">Better Phrasing:</span>
                                <ReactMarkdown className="prose prose-invert text-sm">{feedback.betterAnswer}</ReactMarkdown>
                            </div>

                            <button
                                onClick={nextQuestion}
                                className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-lg"
                            >
                                Next Question ➔
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MockInterviewUI;
