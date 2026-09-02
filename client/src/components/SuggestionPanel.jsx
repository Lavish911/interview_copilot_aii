import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Maximize2, Minimize2, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from './Toaster';

const SuggestionPanel = ({ suggestions }) => {
    const [pipWindow, setPipWindow] = useState(null);
    const [copied, setCopied] = useState(false);

    const copyAnswer = () => {
        navigator.clipboard.writeText(suggestions || '');
        setCopied(true);
        toast('Answer copied to clipboard', 'success');
        setTimeout(() => setCopied(false), 1500);
    };

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
                } catch {
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

                    {suggestions ? (
                        <div className="prose prose-invert prose-xs max-w-none">
                            <ReactMarkdown
                                components={{
                                    h1: ({ ...props }) => <h1 className="text-sm font-bold text-blue-400 mt-2" {...props} />,
                                    h2: ({ ...props }) => <h2 className="text-xs font-bold text-green-400 mt-2" {...props} />,
                                    code: ({ inline, ...props }) => inline
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
            <div className="h-full card p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-[13px] font-semibold tracking-tight">
                        AI Answer
                    </h2>
                    <div className="flex gap-1.5">
                        {suggestions && (
                            <button
                                onClick={copyAnswer}
                                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                                title="Copy Answer"
                            >
                                {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                            </button>
                        )}
                        <button
                            onClick={toggleOverlay}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                            title="Pop Out Overlay"
                        >
                            <ExternalLink size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                    {suggestions ? (
                        <div className="prose prose-sm max-w-none" style={{ color: 'var(--text)' }}>
                            <ReactMarkdown
                                components={{
                                    h1: ({ ...props }) => <h1 className="text-[15px] font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }} {...props} />,
                                    h2: ({ ...props }) => <h2 className="text-[14px] font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }} {...props} />,
                                    h3: ({ ...props }) => <h3 className="text-[13px] font-medium mt-3 mb-1" style={{ color: 'var(--text)' }} {...props} />,
                                    p: ({ ...props }) => <p className="mb-3 leading-relaxed text-[13px]" style={{ color: 'var(--text)' }} {...props} />,
                                    code({ inline, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '')
                                        return !inline && match ? (
                                            <div className="rounded-lg my-3 border overflow-hidden" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                                                <div className="px-3 py-1.5 text-xs flex justify-between items-center border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
                                                    <span className="font-medium">{match[1]}</span>
                                                    <span className="text-[11px]">Code</span>
                                                </div>
                                                <div className="p-3 overflow-x-auto">
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                </div>
                                            </div>
                                        ) : (
                                            <code className="px-1 py-0.5 rounded text-xs font-mono border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} {...props}>
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
                        <div className="flex flex-col items-center justify-center h-full text-center py-10">
                            <div className="w-10 h-10 rounded-full border flex items-center justify-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)'}}>—</div>
                            <p className="mt-3 text-[13px] font-medium">Ready</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)'}}>Speak a question and the answer appears here.</p>
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
