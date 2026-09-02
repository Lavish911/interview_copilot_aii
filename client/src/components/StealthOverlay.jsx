import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';

const StealthOverlay = ({ suggestions, onClose, pipWindow, lastTranscript, onClear }) => {
    const [opacity, setOpacity] = useState(0.92);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && !pipWindow) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, pipWindow]);

    const onMouseDown = (e) => {
        if (pipWindow) return;
        setDragging(true);
        dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    };

    useEffect(() => {
        if (!dragging) return;
        const onMove = (e) => {
            setPos({ x: dragRef.current.origX + (e.clientX - dragRef.current.startX), y: dragRef.current.origY + (e.clientY - dragRef.current.startY) });
        };
        const onUp = () => setDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [dragging]);

    const content = (
        <div
            style={{
                opacity: pipWindow ? 1 : opacity,
                transform: pipWindow ? undefined : `translate(${pos.x}px, ${pos.y}px)`,
            }}
            className={
                pipWindow
                    ? "bg-[#0A0A0A] h-full w-full p-3 flex flex-col text-[13px] leading-relaxed"
                    : "bg-[#0A0A0A] text-white rounded-xl border border-[#242424] shadow-2xl w-[360px] max-h-[520px] flex flex-col overflow-hidden select-none"
            }
        >
            <div
                onMouseDown={onMouseDown}
                className={`flex items-center justify-between px-3 py-2 border-b shrink-0 ${pipWindow ? 'border-[#1A1A1A] cursor-default' : 'border-[#1A1A1A] cursor-move'}`}
                style={{ background: pipWindow ? '#0A0A0A' : '#0A0A0A' }}
            >
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-medium tracking-wide" style={{ color: '#EDEDED' }}>
                        {pipWindow ? 'Hidden • Not on screen share' : 'Stealth • Visible on share'}
                    </span>
                    <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: '#242424', color: '#888', background: '#111' }}>
                        {pipWindow ? 'PiP • Hidden' : 'Use floating for hidden'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {!pipWindow && (
                        <input type="range" min="0.3" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-14 h-1 accent-white" title="Opacity" />
                    )}
                    <button onClick={onClear} className="text-[11px] px-2 py-1 rounded hover:bg-[#1A1A1A] transition-colors" style={{ color: '#888' }}>Clear</button>
                    <button onClick={onClose} className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center text-xs hover:opacity-90">✕</button>
                </div>
            </div>

            {lastTranscript && (
                <div className="mx-3 mt-3 px-2.5 py-2 rounded-lg border text-xs italic leading-relaxed shrink-0" style={{ background: '#111', borderColor: '#242424', color: '#888', borderLeftColor: '#333', borderLeftWidth: 2 }}>
                    {lastTranscript}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 text-[13px] leading-relaxed" style={{ color: '#EDEDED' }}>
                {suggestions ? (
                    <ReactMarkdown
                        components={{
                            h1: ({ ...props }) => <h1 className="text-[14px] font-semibold mt-3 mb-1" {...props} />,
                            h2: ({ ...props }) => <h2 className="text-[13px] font-semibold mt-3 mb-1" {...props} />,
                            h3: ({ ...props }) => <h3 className="text-[13px] font-medium mt-2 mb-1" {...props} />,
                            p: ({ ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                            code({ inline, className, children, ...props }) {
                                const m = /language-(\w+)/.exec(className || '');
                                return !inline && m ? (
                                    <div className="rounded-lg my-2 border overflow-hidden" style={{ background: '#111', borderColor: '#242424' }}>
                                        <div className="px-2.5 py-1 text-[11px] border-b flex justify-between" style={{ borderColor: '#242424', color: '#666' }}>
                                            <span>{m[1]}</span><span>Code</span>
                                        </div>
                                        <pre className="p-2.5 overflow-x-auto text-xs"><code {...props}>{children}</code></pre>
                                    </div>
                                ) : (
                                    <code className="px-1 py-0.5 rounded text-xs border" style={{ background: '#1A1A1A', borderColor: '#242424', color: '#EDEDED' }} {...props}>{children}</code>
                                );
                            },
                            a: ({ ...props }) => <a className="underline" style={{ color: '#EDEDED' }} {...props} />,
                        }}
                    >
                        {suggestions}
                    </ReactMarkdown>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-8 h-8 rounded-full border flex items-center justify-center text-xs" style={{ borderColor: '#242424', color: '#666' }}>●</div>
                        <div className="text-xs mt-2" style={{ color: '#888' }}>Listening…</div>
                        <div className="text-[11px] mt-1" style={{ color: '#666' }}>Speak or share screen. Answer appears here.</div>
                        <div className="text-[10px] mt-3 px-2 py-1 rounded border" style={{ borderColor: '#242424', color: '#666' }}>Ctrl+Enter to ask • Esc to hide</div>
                    </div>
                )}
            </div>

            <div className="px-3 py-2 border-t flex items-center justify-between text-[11px] shrink-0" style={{ borderColor: '#1A1A1A', color: '#666' }}>
                <span>Cluely-style • Hidden from Zoom/Meet/Teams</span>
                <span className="hidden sm:inline">Drag header to move</span>
            </div>
        </div>
    );

    if (pipWindow) {
        const pipRoot = pipWindow.document.getElementById('pip-root');
        if (pipRoot) {
            pipWindow.document.body.style.backgroundColor = '#0A0A0A';
            return createPortal(content, pipRoot);
        }
    }

    return (
        <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="absolute top-6 right-6 pointer-events-auto" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
                {content}
            </div>
        </div>
    );
};

export default StealthOverlay;
