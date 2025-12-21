import React, { useState, useEffect } from 'react';

const ResumeAnalyzer = ({ socket, onExit }) => {
    const [analysis, setAnalysis] = useState(null);
    const [coverLetter, setCoverLetter] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('ats');
    const [questions, setQuestions] = useState([]);
    const [resumeUploadStatus, setResumeUploadStatus] = useState("");
    const [showUploader, setShowUploader] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setResumeUploadStatus("Uploading & Parsing PDF...");

        const formData = new FormData();
        formData.append('file', file);

        try {
            const apiBase = `http://${window.location.hostname}:3000`;
            const res = await fetch(`${apiBase}/api/upload-resume`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setResumeUploadStatus(`✅ Resume Updated! (${data.text.length} chars)`);
                // Auto-run analysis if on ATS tab
                if (activeTab === 'ats') setTimeout(() => runAnalysis(), 500);
            } else {
                setResumeUploadStatus(`❌ Error: ${data.error}`);
            }
        } catch (err) {
            setResumeUploadStatus(`❌ Network Error`);
        }
    };

    const runAnalysis = () => {
        setLoading(true);
        // Send JD with the request for tailored results
        socket.emit('analyzeResume', { jobDescription });
    };

    const runCoverLetter = () => {
        if (!jobDescription) {
            alert("Please paste the Job Description first to generate a tailored letter.");
            return;
        }
        setLoading(true);
        socket.emit('generateCoverLetter', { jobDescription });
    };

    const activePrediction = () => {
        setLoading(true);
        socket.emit('predictQuestions');
    };

    useEffect(() => {
        // Restore State from Server
        socket.emit('requestSessionState');

        socket.on('sessionStateUpdate', (data) => {
            if (data.analysis) setAnalysis(data.analysis);
            if (data.coverLetter) setCoverLetter(data.coverLetter);
        });

        socket.on('resumeAnalysisResult', (data) => {
            setAnalysis(data);
            setLoading(false);
        });

        socket.on('coverLetterResult', (text) => {
            setCoverLetter(text);
            setLoading(false);
        });

        socket.on('predictionResult', (qs) => {
            setQuestions(qs);
            setLoading(false);
        });

        return () => {
            socket.off('sessionStateUpdate');
            socket.off('resumeAnalysisResult');
            socket.off('coverLetterResult');
            socket.off('predictionResult');
        };
    }, [socket]);

    return (
        <div className="flex flex-col h-full p-6 bg-slate-900 text-slate-200 overflow-y-auto">
            <header className="flex justify-between items-start mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                        Wonderin Strategy Suite
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">AI-Powered Resume Tailoring & Cover Letters</p>
                </div>
                <button onClick={onExit} className="text-slate-400 hover:text-white px-3 py-1 border border-slate-700 rounded text-sm">
                    Exit
                </button>
            </header>

            {/* INTEGRATED RESUME UPLOADER */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-dashed border-slate-600 mb-6">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                        📄 Your Resume Context
                        {resumeUploadStatus && <span className="text-white normal-case bg-blue-600 px-2 py-0.5 rounded-full text-[10px]">{resumeUploadStatus}</span>}
                    </label>
                    <button
                        onClick={() => setShowUploader(!showUploader)}
                        className="text-xs text-slate-400 hover:text-white underline"
                    >
                        {showUploader ? "Hide Upload" : "Change Resume"}
                    </button>
                </div>

                {showUploader && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <input
                            type="file"
                            accept=".pdf,.docx,.txt,image/*"
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-slate-400
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-xs file:font-bold
                            file:bg-blue-600 file:text-white
                            hover:file:bg-blue-500
                            cursor-pointer bg-slate-950 rounded-lg border border-slate-700 mb-2"
                        />
                        <p className="text-[10px] text-slate-500 text-center">Supported: PDF, DOCX, TXT, Scanned Images. Data is parsed locally.</p>
                    </div>
                )}
            </div>

            {/* Global JD Input */}
            <div className="mb-6">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Target Job Description (Paste Here for AI Tailoring)</label>
                <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the full job post here... (The AI will use this to tailor your Resume Score and Cover Letter)"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-sm text-slate-300 focus:border-blue-500 outline-none h-24 resize-none"
                />
            </div>

            <div className="flex space-x-2 mb-6">
                <button onClick={() => setActiveTab('ats')} className={`flex-1 py-2 rounded font-bold transition-all ${activeTab === 'ats' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-slate-800 text-slate-400'}`}>
                    📊 ATS Score
                </button>
                <button onClick={() => setActiveTab('coverLetter')} className={`flex-1 py-2 rounded font-bold transition-all ${activeTab === 'coverLetter' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/50' : 'bg-slate-800 text-slate-400'}`}>
                    ✍️ Cover Letter
                </button>
                <button onClick={() => setActiveTab('predict')} className={`flex-1 py-2 rounded font-bold transition-all ${activeTab === 'predict' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'bg-slate-800 text-slate-400'}`}>
                    🔮 Predict Qs
                </button>
            </div>

            {activeTab === 'ats' && (
                <div className="space-y-6">
                    {!analysis ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                            <p className="mb-4 text-slate-400">Analyze your resume against the Job Description above.</p>
                            <button
                                onClick={runAnalysis}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold transition-all flex items-center justify-center mx-auto gap-2"
                            >
                                {loading ? <span className="animate-spin">⏳</span> : "🔍"}
                                {loading ? "Analyzing..." : "Run Tailored ATS Scan"}
                            </button>
                        </div>
                    ) : (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                            {/* Score Header */}
                            <div className="flex items-center justify-between bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6 relative overflow-hidden">
                                <div className={`absolute top-0 left-0 w-2 h-full ${analysis.score > 80 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Match Score</h3>
                                    <div className={`text-5xl font-black ${analysis.score > 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {analysis.score}<span className="text-2xl text-slate-600">/100</span>
                                    </div>
                                </div>
                                <div className="text-right max-w-[60%]">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase">AI Verdict</h3>
                                    <div className="text-lg font-medium text-white leading-tight mt-1">{analysis.summary}</div>
                                </div>
                            </div>

                            {/* Missing Keywords */}
                            <div className="bg-slate-950 p-6 rounded-xl border border-red-900/30 mb-6">
                                <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2">
                                    🛑 Missing Keywords (Critical for {jobDescription ? 'this specific job' : 'this role'})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.keywords_missing.map((kw, i) => (
                                        <span key={i} className="px-3 py-1 bg-red-900/20 text-red-300 rounded-full text-sm border border-red-900/50">
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Improvements */}
                            <div>
                                <h3 className="text-blue-400 font-bold mb-4">✨ AI Suggested Improvements</h3>
                                <div className="space-y-4">
                                    {analysis.improvements.map((item, i) => (
                                        <div key={i} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                                            <div className="text-slate-500 line-through text-xs mb-2 bg-slate-900 p-2 rounded w-fit">{item.original}</div>
                                            <div className="text-green-300 font-medium flex items-start text-sm">
                                                <span className="mr-2 mt-1">🚀</span>
                                                {item.improved}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={runAnalysis}
                                disabled={loading}
                                className={`w-full mt-6 py-3 rounded border border-slate-600 flex items-center justify-center gap-2 transition-all ${loading ? 'bg-slate-900 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                            >
                                {loading ? <span className="animate-spin">⏳</span> : "🔄"}
                                {loading ? "Re-Scanning..." : "Re-Scan"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'coverLetter' && (
                <div className="space-y-6">
                    {!coverLetter ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                            <h3 className="text-xl font-bold text-white mb-2">Generate Tailored Cover Letter</h3>
                            <p className="mb-6 text-slate-400 text-sm max-w-md mx-auto">
                                The AI will analyze your resume and the Job Description to write a compelling, professional cover letter that highlights why YOU are the perfect fit.
                            </p>
                            <button
                                onClick={runCoverLetter}
                                disabled={loading}
                                className="bg-pink-600 hover:bg-pink-500 text-white px-8 py-3 rounded-lg font-bold transition-all flex items-center justify-center mx-auto gap-2 shadow-lg shadow-pink-900/20"
                            >
                                {loading ? <span className="animate-spin">⏳</span> : "✍️"}
                                {loading ? "Writing..." : "Generate Cover Letter"}
                            </button>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-slate-100 text-slate-900 p-8 rounded-xl shadow-2xl font-serif leading-relaxed whitespace-pre-wrap">
                                {coverLetter}
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={() => navigator.clipboard.writeText(coverLetter)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold"
                                >
                                    📋 Copy Text
                                </button>
                                <button
                                    onClick={runCoverLetter}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                                >
                                    🔄 Regenerate
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'predict' && (
                <div className="space-y-6">
                    {!questions.length ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                            <p className="mb-4 text-slate-400">Generate likely questions based on the Job Description.</p>
                            <button
                                onClick={activePrediction}
                                disabled={loading}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-lg shadow-purple-900/20"
                            >
                                {loading ? "Predicting..." : "Generate Predictions"}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {questions.map((q, i) => (
                                <div key={i} className="p-4 bg-slate-800 rounded-lg border border-slate-700 flex items-start hover:bg-slate-750 transition-colors">
                                    <span className="text-purple-400 font-bold mr-3">Q{i + 1}.</span>
                                    <span className="text-slate-200 text-lg">{q}</span>
                                </div>
                            ))}
                            <button
                                onClick={activePrediction}
                                disabled={loading}
                                className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600"
                            >
                                🔄 Refresh Predictions
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResumeAnalyzer;
