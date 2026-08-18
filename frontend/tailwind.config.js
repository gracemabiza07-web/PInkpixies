/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-pink': '#EC4899',
                'brand-pink-light': '#FDF2F8',
                'brand-pink-soft': '#FCE7F3',
                'brand-gray': '#9CA3AF',
                'brand-border': '#E5E7EB',
            },
            fontFamily: {
                'sans': ['Inter', 'sans-serif'],
                'display': ['Playfair Display', 'serif'],
            },
            backgroundImage: {
                'pink-gradient': 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
            }
        },
    },
    plugins: [],
}
