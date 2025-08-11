/**** Tailwind config for Alo-Medical Admin UI ****/
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      container: { center: true, padding: '1rem' },
      colors: {
        accent: {
          DEFAULT: '#2E7DFF',
          foreground: '#ffffff'
        },
        border: 'hsl(210 16% 86%)',
        input: 'hsl(210 16% 96%)',
        ring: '#2E7DFF',
        background: 'hsl(210 20% 98%)',
        foreground: 'hsl(222.2 47.4% 11.2%)',
        muted: {
          DEFAULT: 'hsl(210 16% 96%)',
          foreground: 'hsl(215 16% 46%)'
        },
        card: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(222.2 47.4% 11.2%)'
        },
        destructive: '#E5484D',
        success: '#2EB67D',
        warning: '#F59E0B',
        info: '#3B82F6',
        // Status palette
        status: {
          approved: '#16A34A',
          pending: '#F59E0B',
          rejected: '#EF4444',
        },
      },
      borderRadius: {
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem'
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0,0,0,0.06), 0 1px 3px 1px rgba(0,0,0,0.04)'
      },
      fontSize: {
        xs: ['0.75rem', '1rem'],
        sm: ['0.875rem', '1.25rem'],
        base: ['1rem', '1.5rem'],
        lg: ['1.125rem', '1.75rem'],
        xl: ['1.25rem', '1.75rem'],
        '2xl': ['1.5rem', '2rem'],
        '3xl': ['1.875rem', '2.25rem']
      }
    }
  },
  plugins: [],
}
