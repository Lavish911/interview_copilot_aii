import React from 'react';
import ReactMarkdown from 'react-markdown';

const StealthOverlay = ({ suggestions, onClose }) => {
    const [opacity, setOpacity] = React.useState(0.9);

    return (
        <div className="fixed inset-0 bg-transparent pointer-events-none z-50 flex items-end justify-center pb-10">
            {/* Draggable/Floating Area - Pointer events enabled here */}
            <div
                style={{ opacity: opacity }}
                className="bg-black/95 backdrop-blur-xl pointer-events-auto rounded-xl p-4 w-[600px] border border-slate-700 shadow-2xl transition-all duration-300 hover:opacity-100"
            >
                <div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Stealth Copilot</span>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={opacity}
                            onChange={(e) => setOpacity(parseFloat(e.target.value))}
                            className="w-16 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            title="Adjust Opacity"
                        />
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded bg-gray-800 hover:bg-red-500/20 hover:text-red-400 transition-colors">
                        Exit
                    </button>
                </div>

                <div className="max-h-64 overflow-y-auto text-sm text-gray-300 font-sans prose prose-invert max-w-none">
                    {suggestions ? (
                        <ReactMarkdown
                            components={{
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    return !inline && match ? (
                                        <div className="rounded-md bg-black/50 p-2 my-2 border border-slate-700 overflow-x-auto text-xs">
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        </div>
                                    ) : (
                                        <code className="bg-slate-700 px-1 py-0.5 rounded text-blue-300 text-xs" {...props}>
                                            {children}
                                        </code>
                                    )
                                }
                            }}
                        >
                            {suggestions}
                        </ReactMarkdown>
                    ) : (
                        <div className="text-center italic text-gray-600">Listening...</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StealthOverlay;
