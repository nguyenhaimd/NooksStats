import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for the Google GenAI SDK and existing code compatibility
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || process.env.API_KEY),
      'process.env.YAHOO_CLIENT_ID': JSON.stringify(env.VITE_YAHOO_CLIENT_ID || process.env.YAHOO_CLIENT_ID),
    },
  };
});