import React, { useState, useEffect } from 'react';
import { FileText, Trash2, RefreshCw, Upload, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';
import { toast } from './Toaster';

const DOC_TYPE_LABELS = {
    resume: 'Resume / CV',
    job_description: 'Job Description',
    interview_notes: 'Interview Notes',
    technical_doc: 'Technical Doc',
    general: 'General Doc'
};

const ResumeUploader = ({ socket, apiBaseUrl, documents = [], onClose }) => {
    const [docText, setDocText] = useState("");
    const [docFilename, setDocFilename] = useState("");
    const [docType, setDocType] = useState("resume");
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'info' | 'success' | 'error', text: string }
    const [reindexingId, setReindexingId] = useState(null);

    useEffect(() => {
        const onDocStatus = (payload) => {
            setReindexingId(null);
            if (!payload) return;
            if (payload.status === 'indexing') {
                setUploading(true);
                setStatus({
                    type: 'info',
                    text: `Chunking & generating semantic embeddings for ${payload.filename || 'document'}…`
                });
            } else if (payload.status === 'indexed') {
                setUploading(false);
                const doc = payload.document;
                setStatus({
                    type: 'success',
                    text: `Indexed "${doc?.filename || 'Document'}" — ${doc?.chunkCount || 1} chunk(s) (${doc?.embeddingModel || 'semantic vectors'})`
                });
                toast(`Indexed ${doc?.filename || 'document'} (${doc?.chunkCount || 1} chunks)`, 'success');
            } else if (payload.status === 'error') {
                setUploading(false);
                setStatus({
                    type: 'error',
                    text: payload.error || 'Failed to index document'
                });
                toast(payload.error || 'Document indexing failed', 'error');
            }
        };

        socket.on('rag:documentStatus', onDocStatus);
        return () => {
            socket.off('rag:documentStatus', onDocStatus);
        };
    }, [socket]);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        if (!socket?.id) {
            setStatus({ type: 'error', text: 'Socket session is not connected yet. Please wait a moment.' });
            return;
        }

        setUploading(true);
        setStatus({ type: 'info', text: `Extracting & indexing "${file.name}"…` });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType);
        formData.append('sessionId', socket.id);
        formData.append('replaceExistingType', docType === 'resume' ? 'true' : 'false');

        try {
            const res = await fetch(`${apiBaseUrl}/api/rag/documents`, {
                method: 'POST',
                headers: {
                    'x-session-id': socket.id
                },
                body: formData
            });
            const data = await res.json();
            if (res.ok && data.success && data.document) {
                const doc = data.document;
                setStatus({
                    type: 'success',
                    text: `Indexed "${doc.filename}" — ${doc.chunkCount} chunk(s)${doc.pageCount ? ` across ${doc.pageCount} page(s)` : ''} via ${doc.embeddingModel}`
                });
                toast(`Indexed "${doc.filename}" (${doc.chunkCount} chunks)`, 'success');
            } else {
                setStatus({
                    type: 'error',
                    text: data.error || 'Upload or embedding generation failed.'
                });
                toast(data.error || 'Upload failed', 'error');
            }
        } catch (err) {
            setStatus({ type: 'error', text: `Network error: ${err.message}` });
        } finally {
            setUploading(false);
        }
    };

    const handlePasteSubmit = (e) => {
        e.preventDefault();
        if (docText.trim().length < 15) {
            setStatus({ type: 'error', text: 'Please enter at least 15 characters of text to index.' });
            return;
        }

        const defaultName = docType === 'resume'
            ? 'Candidate_Resume.txt'
            : docType === 'job_description'
            ? 'Target_Job_Description.txt'
            : docType === 'interview_notes'
            ? 'Interview_Notes.md'
            : 'Technical_Doc.md';

        const filename = docFilename.trim() || defaultName;
        setUploading(true);

        if (docType === 'resume') {
            socket.emit('updateResume', docText);
        } else {
            socket.emit('rag:uploadDocument', {
                filename,
                docType,
                text: docText,
                replaceExistingType: false
            });
        }
        setDocText("");
        setDocFilename("");
    };

    const handleDelete = (docId, filename) => {
        socket.emit('rag:deleteDocument', { docId });
        toast(`Removed "${filename}" from RAG index`, 'info');
    };

    const handleReindex = (docId) => {
        setReindexingId(docId);
        socket.emit('rag:reindexDocument', { docId });
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div
                className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[20px] border shadow-2xl overflow-hidden animate-fade-up"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
                <div className="p-6 pb-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <BookOpen size={18} />
                            <h2 className="text-lg font-semibold">RAG Knowledge Base & Resume</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full border flex items-center justify-center hover:opacity-80"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        >
                            ✕
                        </button>
                    </div>
                    <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        Upload resumes, job descriptions, or technical notes. Documents are chunked, embedded with semantic vectors, and retrieved to ground interview answers with citations.
                    </p>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Document Type Selector */}
                    <div>
                        <label className="block text-[11px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-faint)' }}>
                            1. Select Document Category
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['resume', 'job_description', 'interview_notes', 'technical_doc'].map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setDocType(type)}
                                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                                        docType === type
                                            ? 'bg-[#0A0A0A] text-white dark:bg-white dark:text-black border-[#0A0A0A] dark:border-white'
                                            : ''
                                    }`}
                                    style={docType !== type ? { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-muted)' } : {}}
                                >
                                    {DOC_TYPE_LABELS[type]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* File Upload Box */}
                    <div className="rounded-xl border border-dashed p-4" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-strong)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold tracking-widest uppercase flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
                                <Upload size={12} /> 2. Upload File (PDF, DOCX, TXT, MD — Max 5MB)
                            </span>
                        </div>
                        <input
                            type="file"
                            accept=".pdf,.docx,.txt,.md"
                            disabled={uploading}
                            onChange={handleFileUpload}
                            className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#0A0A0A] dark:file:bg-white file:text-white dark:file:text-black cursor-pointer disabled:opacity-50"
                            style={{ color: 'var(--text-muted)' }}
                        />
                    </div>

                    <div className="text-center text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
                        — or paste document text —
                    </div>

                    {/* Paste Text Form */}
                    <form onSubmit={handlePasteSubmit} className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={docFilename}
                                onChange={(e) => setDocFilename(e.target.value)}
                                placeholder={`Optional title (e.g. ${docType === 'resume' ? 'Senior_SWE_Resume.txt' : 'System_Design_Notes.md'})`}
                                className="flex-1 rounded-lg border px-3 py-2 text-xs"
                                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                            />
                        </div>
                        <textarea
                            value={docText}
                            onChange={(e) => setDocText(e.target.value)}
                            placeholder="Paste resume, job description, or technical documentation here…"
                            className="w-full h-28 rounded-xl border p-3 text-xs resize-none leading-relaxed"
                            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                        <button
                            type="submit"
                            disabled={uploading || docText.trim().length < 15}
                            className="w-full py-2.5 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-xs font-medium disabled:opacity-40 transition-opacity"
                        >
                            {uploading ? 'Indexing & Embedding…' : `Index ${DOC_TYPE_LABELS[docType]} into RAG`}
                        </button>
                    </form>

                    {/* Status Banner */}
                    {status && (
                        <div
                            className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-start gap-2 ${
                                status.type === 'error'
                                    ? 'bg-red-500/10 border-red-500/30 text-red-500'
                                    : status.type === 'success'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                    : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                            }`}
                        >
                            {status.type === 'error' ? <AlertCircle size={15} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={15} className="shrink-0 mt-0.5" />}
                            <span>{status.text}</span>
                        </div>
                    )}

                    {/* Indexed Session Documents List */}
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
                                Active Session Knowledge Base ({documents.length} {documents.length === 1 ? 'document' : 'documents'})
                            </span>
                            <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                                Isolated to this session
                            </span>
                        </div>

                        {documents.length === 0 ? (
                            <div className="rounded-xl border p-4 text-center text-xs" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                No documents indexed yet. Upload a resume, job description, or notes above to enable RAG-grounded answers.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {documents.map((doc) => (
                                    <div
                                        key={doc.docId}
                                        className="rounded-xl border p-3 flex items-center justify-between gap-3"
                                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <FileText size={14} className="shrink-0" />
                                                <span className="text-xs font-semibold truncate">{doc.filename}</span>
                                                <span
                                                    className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                                                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
                                                >
                                                    {DOC_TYPE_LABELS[doc.docType] || doc.docType}
                                                </span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono">
                                                    {doc.chunkCount} {doc.chunkCount === 1 ? 'chunk' : 'chunks'}
                                                </span>
                                            </div>
                                            <div className="text-[11px] mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-faint)' }}>
                                                <span>{(doc.charCount / 1000).toFixed(1)}k chars</span>
                                                {doc.pageCount && <span>· {doc.pageCount} page(s)</span>}
                                                {doc.embeddingModel && <span>· {doc.embeddingModel}</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleReindex(doc.docId)}
                                                disabled={reindexingId === doc.docId}
                                                title="Re-index embeddings"
                                                className="p-1.5 rounded-lg border hover:opacity-80 disabled:opacity-40"
                                                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                            >
                                                <RefreshCw size={13} className={reindexingId === doc.docId ? 'animate-spin' : ''} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(doc.docId, doc.filename)}
                                                title="Delete document from RAG index"
                                                className="p-1.5 rounded-lg border hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        Vectors are automatically purged when your session disconnects.
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border text-xs font-medium"
                        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResumeUploader;
