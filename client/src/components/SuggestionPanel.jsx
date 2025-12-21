import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Maximize2, Minimize2, ExternalLink } from 'lucide-react';

const SuggestionPanel = ({ suggestions }) => {
    const [pipWindow, setPipWindow] = useState(null);

    const toggleOverlay = async () => {
        if (pipWindow) {
            pipWindow.close();
            setPipWindow(null);
            return;
        }

        if (!window.documentPictureInPicture) {
            alert("Your browser doesn't support Document Picture-in-Picture. Try Chrome 111+.");
            return;
        }

        try {
            const pip = await window.documentPictureInPicture.requestWindow({
                width: 400,
                height: 600,
            });

            // Copy styles
            [...document.styleSheets].forEach((styleSheet) => {
                try {
                    const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
                    const style = document.createElement('style');
                    style.textContent = cssRules;
                    pip.document.head.appendChild(style);
                } catch (e) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.type = styleSheet.type;
                    link.media = styleSheet.media;
                    link.href = styleSheet.href;
                    pip.document.head.appendChild(link);
                }
            });

            // Listen for close
            pip.addEventListener('pagehide', () => {
                setPipWindow(null);
            });

            setPipWindow(pip);
        } catch (err) {
            console.error("PiP start failed:", err);
        }
    };

    const Content = () => {
        // STEALTH MODE: Minimal UI for PiP
        if (pipWindow) {
            return (
                <div className="h-full bg-black text-gray-200 p-2 overflow-y-auto font-sans text-xs">
                    <style>{`
                        ::-webkit-scrollbar { width: 3px; }
                        ::-webkit-scrollbar-track { background: #000; }
                        ::-webkit-scrollbar-thumb { background: #333; }
                        body { margin: 0; background: black; }
                    `}</style>

                    {loading ? (
                        <div className="flex items-center gap-2 text-yellow-500 animate-pulse mt-1">
                            <span>Listening...</span>
                        </div>
                    ) : suggestions ? (
                        <div className="prose prose-invert prose-xs max-w-none">
                            <ReactMarkdown
                                components={{
                                    h1: ({ node, ...props }) => <h1 className="text-sm font-bold text-blue-400 mt-2" {...props} />,
                                    h2: ({ node, ...props }) => <h2 className="text-xs font-bold text-green-400 mt-2" {...props} />,
                                    code: ({ node, inline, ...props }) => inline
                                        ? <code className="text-pink-400 bg-gray-900 px-1 rounded" {...props} />
                                        : <pre className="bg-gray-900 p-1 my-1 overflow-x-auto border-l-2 border-blue-500"><code {...props} /></pre>
                                }}
                            >
                                {suggestions}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="text-gray-600 italic">Stealth Ready...</div>
                    )}
                </div>
            );
        }

        // REGULAR DASHBOARD MODE (Rich UI)
        return (
            <div className={`h-full bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 flex flex-col shadow-2xl`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-2">
                        <span>💡</span> AI Smart Suggestions
                    </h2>
                    <button
                        onClick={toggleOverlay}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                        title="Pop Out Overlay"
                    >
                        <ExternalLink size={18} />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                    {suggestions ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown
                                components={{
                                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-white mb-4 mt-6 border-b border-slate-700 pb-2" {...props} />,
                                    h2: ({ node, ...props }) => <h2 className="text-xl font-semibold text-blue-300 mb-3 mt-5" {...props} />,
                                    h3: ({ node, ...props }) => <h3 className="text-lg font-medium text-purple-300 mb-2 mt-4" {...props} />,
                                    p: ({ node, ...props }) => <p className="text-slate-300 mb-4 leading-7" {...props} />,
                                    code({ node, inline, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '')
                                        return !inline && match ? (
                                            <div className="rounded-lg bg-[#0d1117] my-4 border border-slate-700/50 overflow-hidden shadow-lg">
                                                <div className="bg-slate-800/50 px-3 py-1 text-xs text-slate-400 flex justify-between items-center border-b border-slate-700/50">
                                                    <span>{match[1]}</span>
                                                    <span className="text-[10px] uppercase tracking-wider">Code Snippet</span>
                                                </div>
                                                <div className="p-4 overflow-x-auto">
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                </div>
                                            </div>
                                        ) : (
                                            <code className="bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20 font-mono text-sm" {...props}>
                                                {children}
                                            </code>
                                        )
                                    }
                                }}
                            >
                                {suggestions}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3 opacity-60">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center animate-pulse">
                                <span className="text-2xl">🧠</span>
                            </div>
                            <p className="italic font-medium">Listening for technical questions...</p>
                            <p className="text-xs text-slate-600">Try: "Explain Big O notation"</p>
                        </div>
                    )}
                </div>

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background-color: rgba(71, 85, 105, 0.4);
                        border-radius: 20px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background-color: rgba(71, 85, 105, 0.6);
                    }
                `}</style>
            </div>
        );
    };

    if (pipWindow) {
        return (
            <>
                <div className="h-full flex items-center justify-center text-slate-500 border border-slate-800 rounded-xl bg-slate-900/50">
                    <p>Subtitles active in Overlay Window</p>
                </div>
                {createPortal(<Content />, pipWindow.document.body)}
            </>
        );
    }

    return <Content />;
};

export default SuggestionPanel;
