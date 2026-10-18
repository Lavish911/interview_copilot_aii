import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from './Toaster';

const SuggestionPanel = ({ suggestions, loading = false, onPopOut }) => {
    const [copied, setCopied] = useState(false);

    const copyAnswer = () => {
        navigator.clipboard.writeText(suggestions || '');
        setCopied(true);
        toast('Answer copied to clipboard', 'success');
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="h-full card p-5 flex flex-col">
            <div className="flex justify-between items-center pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                    <h2 className="text-[13px] font-semibold tracking-tight">AI Answer</h2>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Streams in real time as you speak</span>
                </div>
                <div className="flex gap-1.5">
                    {suggestions && (
                        <button
                            onClick={copyAnswer}
                            className="p-2 rounded-lg border transition-colors hover:opacity-80"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                            title="Copy Answer"
                        >
                            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                    )}
                    {onPopOut && (
                        <button
                            onClick={onPopOut}
                            className="p-2 rounded-lg border transition-colors hover:opacity-80"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                            title="Pop Out Floating Window"
                        >
                            <ExternalLink size={16} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-2">
                {suggestions ? (
                    <div className="prose prose-sm max-w-none" style={{ color: 'var(--text)' }}>
                        <ReactMarkdown
                            components={{
                                h1: ({ ...props }) => <h1 className="text-[15px] font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }} {...props} />,
                                h2: ({ ...props }) => <h2 className="text-[14px] font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }} {...props} />,
                                h3: ({ ...props }) => <h3 className="text-[13px] font-medium mt-3 mb-1" style={{ color: 'var(--text)' }} {...props} />,
                                p: ({ ...props }) => <p className="mb-3 leading-relaxed text-[13px]" style={{ color: 'var(--text)' }} {...props} />,
                                code({ inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
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
                                    );
                                }
                            }}
                        >
                            {suggestions}
                        </ReactMarkdown>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10">
                        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
                        <p className="mt-3 text-[13px] font-medium" style={{ color: 'var(--text)' }}>Generating answer...</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Streaming response via AI cascade...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10">
                        <div className="w-10 h-10 rounded-full border flex items-center justify-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>—</div>
                        <p className="mt-3 text-[13px] font-medium">Ready</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Speak a question and the answer appears here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SuggestionPanel;
