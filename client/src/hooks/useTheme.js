import React, { useState, useEffect } from 'react';

export function useTheme() {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('ic.theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('ic.theme', theme);
    }, [theme]);

    return [theme, setTheme];
}
