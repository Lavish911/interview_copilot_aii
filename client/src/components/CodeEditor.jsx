import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Code } from 'lucide-react';

const CodeEditor = () => {
    const [code, setCode] = useState("// Start coding your solution here...\nfunction solution() {\n  \n}");
    const [output, setOutput] = useState("");

    const handleRun = () => {
        // Mock run
        setOutput("Running tests...\nTest 1: PASSED\nTest 2: PASSED\nOutput: [1, 2, 3]");
    };

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e] rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
            {/* Toolbar */}
            <div className="bg-[#2d2d2d] p-3 flex justify-between items-center border-b border-slate-700">
                <div className="flex items-center gap-2 text-slate-300">
                    <Code size={16} className="text-blue-400" />
                    <span className="text-sm font-mono font-bold">solution.js</span>
                </div>
                <button
                    onClick={handleRun}
                    className="flex items-center gap-1 bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                >
                    <Play size={12} fill="currentColor" /> Run Code
                </button>
            </div>

            <div className="flex-1 flex">
                {/* Editor */}
                <div className="w-2/3 border-r border-slate-700">
                    <Editor
                        height="100%"
                        defaultLanguage="javascript"
                        theme="vs-dark"
                        value={code}
                        onChange={(val) => setCode(val)}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            scrollBeyondLastLine: false,
                            padding: { top: 20 }
                        }}
                    />
                </div>

                {/* Output / Console */}
                <div className="w-1/3 bg-[#1e1e1e] flex flex-col">
                    <div className="p-2 bg-[#252526] text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                        Console Output
                    </div>
                    <div className="p-4 font-mono text-sm text-slate-300 whitespace-pre-wrap">
                        {output || <span className="text-slate-600 italic">// Output will appear here</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;
