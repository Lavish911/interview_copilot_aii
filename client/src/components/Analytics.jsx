import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Analytics = ({ socket }) => {
    const [metrics, setMetrics] = useState({ wordCount: 0, fillers: [], pace: 'Waiting…', score: '0' });
    const [chartData, setChartData] = useState([{ name: 'Start', score: 5 }]);
    const [totals, setTotals] = useState({ words: 0, fillers: 0, responses: 0, scoreSum: 0 });

    useEffect(() => {
        if (!socket) return;
        socket.on('speechAnalysisResult', (data) => {
            setMetrics(data);
            setTotals(prev => ({ words: prev.words + (data.wordCount||0), fillers: prev.fillers + (data.fillers?.length||0), responses: prev.responses+1, scoreSum: prev.scoreSum + (parseFloat(data.score)||0) }));
            setChartData(prev => [...prev, { name: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}), score: parseFloat(data.score)||0 }].slice(-15));
        });
        return () => socket.off('speechAnalysisResult');
    }, [socket]);

    const avg = totals.responses ? (totals.scoreSum/totals.responses).toFixed(1) : '—';

    return (
        <div className="p-6 md:p-8 max-w-[860px] mx-auto w-full">
            <div className="cluely-hero p-6 mb-6">
                <div className="text-[11px] tracking-wide uppercase" style={{ color:'var(--text-faint)'}}>Insights</div>
                <h2 className="text-xl font-semibold tracking-tight mt-1">How you sound</h2>
                <p className="text-[13px] mt-1" style={{ color:'var(--text-muted)'}}>Speak in Copilot to see live feedback.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                    {l:'Last score', v: metrics.score, s:'/10'},
                    {l:'Average', v: avg, s:`over ${totals.responses}`},
                    {l:'Fillers', v: totals.fillers, s:'total'},
                    {l:'Words', v: totals.words, s:'total'},
                ].map(item=>(
                    <div key={item.l} className="card p-4">
                        <div className="text-[11px] tracking-wide uppercase" style={{ color:'var(--text-faint)'}}>{item.l}</div>
                        <div className="mt-2 text-xl font-semibold">{item.v}<span className="text-xs font-normal ml-1" style={{ color:'var(--text-muted)'}}>{item.s}</span></div>
                    </div>
                ))}
            </div>

            <div className="card p-5">
                <div className="text-[13px] font-medium mb-4">Clarity over time</div>
                <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" stroke="var(--text-faint)" tick={{fontSize:10}} />
                            <YAxis stroke="var(--text-faint)" domain={[0,10]} tick={{fontSize:10}} />
                            <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', borderRadius: 8 }} />
                            <Area type="monotone" dataKey="score" stroke="#0A0A0A" fill="#0A0A0A" fillOpacity={0.08} strokeWidth={1.5} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {totals.responses===0 && <div className="mt-4 card p-6 text-center text-[13px]" style={{ color:'var(--text-muted)'}}>No data yet — turn on the mic in Copilot.</div>}
        </div>
    );
};

export default Analytics;
