import React from 'react';
import { motion } from 'framer-motion';
import { Play, TrendingUp, Calendar, Clock } from 'lucide-react';

const Dashboard = ({ onStartMock, onStartCopilot }) => {
    return (
        <div className="p-8 text-white h-full overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                    Welcome back, Alex.
                </h1>
                <p className="text-slate-400">Ready to ace your next Big Tech interview?</p>
            </motion.div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    onClick={onStartCopilot}
                    className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 cursor-pointer hover:border-blue-500/50 transition-colors group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Play size={100} className="text-blue-500" />
                    </div>
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 text-blue-400">
                        <Calendar size={24} />
                    </div>
                    <h3 className="text-xl font-bold mb-1">Interview Copilot</h3>
                    <p className="text-slate-400 text-sm">Real-time transcription & answer suggestions. Stealth mode enabled.</p>
                </motion.div>

                <motion.div
                    whileHover={{ scale: 1.02 }}
                    onClick={onStartMock}
                    className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 cursor-pointer hover:border-purple-500/50 transition-colors group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Play size={100} className="text-purple-500" />
                    </div>
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 text-purple-400">
                        <Clock size={24} />
                    </div>
                    <h3 className="text-xl font-bold mb-1">Mock Interview</h3>
                    <p className="text-slate-400 text-sm">Practice with an AI interviewer. Get scored feedback instantly.</p>
                </motion.div>
            </div>

            {/* Stats Row */}
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-green-400" /> Your Activity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="text-slate-500 text-xs uppercase font-bold mb-1">Mock Interviews</div>
                    <div className="text-3xl font-mono font-bold text-white">12</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="text-slate-500 text-xs uppercase font-bold mb-1">Avg Score</div>
                    <div className="text-3xl font-mono font-bold text-green-400">8.5</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="text-slate-500 text-xs uppercase font-bold mb-1">Resume Keywords</div>
                    <div className="text-3xl font-mono font-bold text-blue-400">92%</div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
