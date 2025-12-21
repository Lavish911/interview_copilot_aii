import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
    { name: 'Mon', score: 4 },
    { name: 'Tue', score: 6 },
    { name: 'Wed', score: 5 },
    { name: 'Thu', score: 8 },
    { name: 'Fri', score: 9 },
    { name: 'Sat', score: 8 },
    { name: 'Sun', score: 9.5 },
];

const Analytics = ({ socket }) => {
    // --- Real-time Speech Metrics ---
    const [metrics, setMetrics] = React.useState({ wordCount: 0, fillers: [], pace: 'Waiting...', score: 0 });
    const [chartData, setChartData] = React.useState([
        { name: 'Start', score: 5 }
    ]);

    React.useEffect(() => {
        if (!socket) return;
        socket.on('speechAnalysisResult', (data) => {
            setMetrics(data);

            // Update Chart history
            setChartData(prev => {
                const newData = [...prev, {
                    name: new Date().toLocaleTimeString([], { second: '2-digit' }),
                    score: parseFloat(data.score)
                }];
                return newData.slice(-10); // Keep last 10 points
            });
        });
        return () => socket.off('speechAnalysisResult');
    }, [socket]);

    return (
        <div className="p-8 text-white h-full overflow-y-auto">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                Performance Analytics
            </h2>

            {/* REAL-TIME SPEECH CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* PACE CARD */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Speech Pace</h3>
                    <div className="flex items-baseline">
                        <span className="text-3xl font-black text-white">{metrics.pace}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Target: Moderate (130-150 wpm)</p>
                </div>

                {/* FILLER WORDS CARD */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Filler Words Detected</h3>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black ${metrics.fillers.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {metrics.fillers.length}
                        </span>
                        <span className="text-sm text-slate-500">last sentence</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {metrics.fillers.map((w, i) => (
                            <span key={i} className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded border border-red-500/30">
                                {w}
                            </span>
                        ))}
                        {metrics.fillers.length === 0 && <span className="text-xs text-green-500/50 italic">Clean speech detected</span>}
                    </div>
                </div>

                {/* WORD COUNT CARD */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Session Word Count</h3>
                    <div className="flex items-baseline">
                        <span className="text-3xl font-black text-white">{metrics.wordCount}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Words analyzed in current chunk</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 mb-8">
                <h3 className="text-lg font-bold mb-4 text-slate-300">Live Clarity Score Trend</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" domain={[0, 10]} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="score" stroke="#8884d8" fillOpacity={1} fill="url(#colorScore)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Weak/Strong Areas (Static for now) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-80">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <h3 className="text-lg font-bold mb-4 text-slate-300">Weak Areas</h3>
                    <ul className="space-y-3">
                        <li className="flex justify-between items-center text-sm">
                            <span className="text-red-400">System Design</span>
                            <span className="text-slate-500">Score: 4/10</span>
                        </li>
                    </ul>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <h3 className="text-lg font-bold mb-4 text-slate-300">Strong Areas</h3>
                    <ul className="space-y-3">
                        <li className="flex justify-between items-center text-sm">
                            <span className="text-green-400">CSS / UI</span>
                            <span className="text-slate-500">Score: 10/10</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
