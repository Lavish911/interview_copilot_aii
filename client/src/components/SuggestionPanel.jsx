import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, Copy, Check, BookOpen, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from './Toaster';

const SuggestionPanel = ({
    suggestions,
    loading = false,
    onPopOut,
    ragContext = null,
    documentsCount = 0,
    onManageDocs = null
}) => {
    const [copied, setCopied] = useState(false);
    const [showSources, setShowSources] = useState(true);

    const copyAnswer = () => {
        navigator.clipboard.writeText(suggestions || '');
        setCopied(true);
        toast('Answer copied to clipboard', 'success');
        setTimeout(() => setCopied(false), 1500);
    };

    const isGrounded = Boolean(ragContext?.grounded && Array.isArray(ragContext?.sources) && ragContext.sources.length > 0);
    const sources = isGrounded ? ragContext.sources : [];

    return (
        <div className="h-full card p-5 flex flex-col">
            <div className="flex justify-between items-start gap-2 pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-[13px] font-semibold tracking-tight">AI Answer</h2>
                        {suggestions && ragContext && (
                            isGrounded ? (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 flex items-center gap-1">
                                    <BookOpen size={11} />
                                    Grounded in {sources.length} {sources.length === 1 ? 'passage' : 'passages'}
                                </span>
                            ) : ragContext.status === 'NO_RELEVANT_MATCH' ? (
                                <span
                                    className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
                                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                >
                                    General AI · No matching passage in uploaded docs
                                </span>
                            ) : ragContext.status === 'OFFLINE_FALLBACK' ? (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-500">
                                    Offline Engine · Not document-grounded
                                </span>
                            ) : null
                        )}
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {documentsCount > 0
                            ? `RAG active (${documentsCount} ${documentsCount === 1 ? 'document' : 'documents'} indexed) · Streams in real time`
                            : 'Streams in real time · Upload a resume or doc to enable RAG grounding'}
                    </span>
                </div>

                <div className="flex gap-1.5 shrink-0">
                    {onManageDocs && (
                        <button
                            onClick={onManageDocs}
                            className="px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors hover:opacity-80"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                            title="Manage RAG Knowledge Base Documents"
                        >
                            <BookOpen size={14} />
                            <span className="hidden sm:inline">Docs ({documentsCount})</span>
                        </button>
                    )}
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

            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                {suggestions ? (
                    <>
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

                        {/* Retrieved Source Citations Section */}
                        {isGrounded && (
                            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowSources(!showSources)}
                                    className="w-full flex items-center justify-between text-left text-xs font-semibold tracking-wide uppercase py-1"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <FileText size={13} className="text-emerald-500" />
                                        Retrieved Source Citations ({sources.length})
                                    </span>
                                    {showSources ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>

                                {showSources && (
                                    <div className="mt-2.5 space-y-2">
                                        {sources.map((src) => (
                                            <div
                                                key={src.chunkId || src.sourceIndex}
                                                className="rounded-xl border p-3 text-xs"
                                                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                                            >
                                                <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono text-[10px] font-semibold">
                                                            Source {src.sourceIndex}
                                                        </span>
                                                        <span className="font-semibold" style={{ color: 'var(--text)' }}>
                                                            {src.filename}
                                                        </span>
                                                        {src.pageNumber && (
                                                            <span className="px-1.5 py-0.5 rounded border text-[10px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                                                Page {src.pageNumber}
                                                            </span>
                                                        )}
                                                        {src.sectionTitle && (
                                                            <span className="px-1.5 py-0.5 rounded border text-[10px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                                                § {src.sectionTitle}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {typeof src.score === 'number' && (
                                                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                                                            {Math.round(src.score * 100)}% cosine match
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[12px] leading-relaxed italic" style={{ color: 'var(--text-muted)' }}>
                                                    “{src.excerpt}”
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10">
                        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
                        <p className="mt-3 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                            {documentsCount > 0 ? 'Retrieving context & generating grounded answer...' : 'Generating answer...'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Streaming response via AI cascade...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10">
                        <div className="w-10 h-10 rounded-full border flex items-center justify-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>—</div>
                        <p className="mt-3 text-[13px] font-medium">Ready</p>
                        <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
                            {documentsCount > 0
                                ? `Speak or type an interview question. Answers will automatically retrieve relevant passages from your ${documentsCount} indexed document(s).`
                                : 'Speak or type a question, or upload your resume & notes to enable RAG document-grounded answers.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SuggestionPanel;
