import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export const toast = (message, type = 'info') => {
    window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message, type, id: `${Date.now()}-${Math.random()}` }
    }));
};

const ICONS = {
    success: <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />,
    error: <XCircle size={16} className="text-red-400 shrink-0" />,
    info: <Info size={16} className="text-blue-400 shrink-0" />,
};

const BORDERS = {
    success: 'border-emerald-500/30',
    error: 'border-red-500/30',
    info: 'border-blue-500/30',
};

export default function Toaster() {
    const [items, setItems] = useState([]);

    useEffect(() => {
        const onToast = (e) => {
            const t = e.detail;
            setItems(prev => [...prev.slice(-4), t]);
            setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), 4000);
        };
        window.addEventListener('app-toast', onToast);
        return () => window.removeEventListener('app-toast', onToast);
    }, []);

    return createPortal(
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 w-80 max-w-[calc(100vw-3rem)]">
            {items.map(t => (
                <div
                    key={t.id}
                    className={`animate-toast-in flex items-start gap-2.5 glass border ${BORDERS[t.type] || BORDERS.info} rounded-2xl px-4 py-3.5 shadow-2xl text-sm text-slate-100`}
                >
                    {ICONS[t.type] || ICONS.info}
                    <span className="leading-snug font-medium">{t.message}</span>
                </div>
            ))}
        </div>,
        document.body
    );
}
