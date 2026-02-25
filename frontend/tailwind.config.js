/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                sss: {
                    primary: '#6366f1',
                    secondary: '#818cf8',
                    accent: '#a5b4fc',
                    dark: '#0f172a',
                    surface: '#1e293b',
                    border: '#334155',
                },
            },
        },
    },
    plugins: [],
};
