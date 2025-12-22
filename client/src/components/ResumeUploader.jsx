import React, { useState } from 'react';

const ResumeUploader = ({ socket, apiBaseUrl, onClose }) => {
    const [resumeText, setResumeText] = useState("");
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (resumeText.trim().length < 10) {
            setStatus("Resume text too short.");
            return;
        }

        socket.emit('updateResume', resumeText);
        setStatus("Resume sent to Interview Coach! ✅");
        setTimeout(() => {
            onClose();
        }, 1500); // Close after success msg
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg p-6 rounded-xl shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    ✕
                </button>

                <h2 className="text-2xl font-bold mb-2 text-white">Upload Context</h2>
                <p className="text-slate-400 mb-4 text-sm">Upload your resume (PDF/DOCX) or paste text. The AI will tailor answers to this context.</p>

                <div className="mb-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700 border-dashed">
                    <label className="block text-blue-300 text-xs font-bold mb-2 uppercase tracking-wide">
                        📁 Upload File
                    </label>
                    <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setUploading(true);
                            setStatus("Uploading & Parsing...");

                            const formData = new FormData();
                            formData.append('file', file);

                            try {
                                 const res = await fetch(`${apiBaseUrl}/api/upload-resume`, {
                                    method: 'POST',
                                    body: formData
                                });
                                const data = await res.json();
                                if (data.success) {
                                    setResumeText(data.text);
                                    setStatus(`Success! Extracted ${data.text.length} characters.`);
                                } else {
                                    setStatus(`Server Error: ${data.error || "Unknown"}`);
                                }
                            } catch (err) {
                                console.error(err);
                                setStatus(`Network Error: ${err.message}`);
                            } finally {
                                setUploading(false);
                            }
                        }}
                        className="block w-full text-sm text-slate-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-xs file:font-bold
                        file:bg-blue-600 file:text-white
                        hover:file:bg-blue-500
                        cursor-pointer"
                    />
                    {uploading && <p className="text-xs text-blue-400 mt-2 animate-pulse">Processing...</p>}
                </div>

                <div className="text-center text-slate-600 text-xs mb-4 font-bold">- OR PASTE TEXT -</div>

                <textarea
                    className="w-full h-32 bg-slate-950 border border-slate-800 rounded p-3 text-sm text-slate-300 focus:border-blue-500 focus:outline-none resize-none font-mono"
                    placeholder="Paste text here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                ></textarea>

                <div className="flex items-center justify-between mt-4">
                    <span className="text-green-400 text-sm font-bold">{status}</span>
                    <button
                        onClick={handleSubmit}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                    >
                        Start Using Context
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResumeUploader;
