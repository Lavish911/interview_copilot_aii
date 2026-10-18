import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

const STARTER = `// Try it — edit and hit Run
function reverseString(s) {
  return s.split('').reverse().join('');
}
console.log(reverseString('interview'));
`;

const CodeEditor = () => {
    const [code, setCode] = useState(STARTER);
    const [output, setOutput] = useState([]);
    const [running, setRunning] = useState(false);
    const workerRef = useRef(null);
    const timeoutRef = useRef(null);

    useEffect(() => () => { if (workerRef.current) workerRef.current.terminate(); if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

    const handleRun = () => {
        if (running) return;
        if (workerRef.current) workerRef.current.terminate();
        setRunning(true); setOutput([{ type: 'muted', text: 'Running…' }]);
        const worker = new Worker(new URL('../workers/jsRunner.js', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        timeoutRef.current = setTimeout(() => { worker.terminate(); setRunning(false); setOutput([{ type: 'error', text: 'Timed out after 5s' }]); }, 5000);
        worker.onmessage = (e) => { clearTimeout(timeoutRef.current); worker.terminate(); setRunning(false); setOutput(e.data.logs.map(l=>({ type: l.startsWith('[error]')?'error':l.startsWith('[warn]')?'warn':'log', text:l })) ); };
        worker.onerror = (e) => { clearTimeout(timeoutRef.current); worker.terminate(); setRunning(false); setOutput([{ type:'error', text:e.message }]); };
        worker.postMessage({ code });
    };

    return (
        <div className="max-w-[960px] mx-auto w-full">
            <div className="cluely-hero p-6 flex items-center justify-between mb-4">
                <div>
                    <div className="text-[11px] tracking-wide uppercase" style={{ color:'var(--text-faint)'}}>Code Lab</div>
                    <h2 className="text-[16px] font-semibold mt-1">Try code instantly</h2>
                    <p className="text-[13px]" style={{ color:'var(--text-muted)'}}>Runs in your browser only.</p>
                </div>
                <button onClick={handleRun} disabled={running} className="px-4 py-2 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium disabled:opacity-50">
                    {running?'Running…':'Run'}
                </button>
            </div>

            <div className="card overflow-hidden flex flex-col min-h-[480px]">
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 min-h-0">
                    <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r min-h-[300px]" style={{ borderColor:'var(--border)'}}>
                        <Editor height="100%" defaultLanguage="javascript" theme="vs-dark" value={code} onChange={(v)=>setCode(v??'')} options={{ minimap:{enabled:false}, fontSize:13, scrollBeyondLastLine:false, padding:{top:12}, automaticLayout:true }} />
                    </div>
                    <div className="lg:col-span-2 flex flex-col min-h-[180px]" style={{ background:'var(--surface-2)'}}>
                        <div className="px-4 py-2.5 border-b flex items-center justify-between text-xs" style={{ borderColor:'var(--border)', color:'var(--text-faint)'}}>
                            <span className="tracking-wide uppercase font-medium">Output</span>
                            {output.length>0 && <button onClick={()=>setOutput([])} className="hover:opacity-70">Clear</button>}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
                            {output.length===0 ? <span style={{ color:'var(--text-faint)'}}>Run to see output.</span> : output.map((l,i)=><div key={i} className={l.type==='error'?'text-red-500':'text-[var(--text)]'} style={{ whiteSpace:'pre-wrap'}}>{l.text}</div>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;
