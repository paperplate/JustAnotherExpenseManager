import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    minify: false,
    outDir: 'JustAnotherExpenseManager/static/js',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        filter_component: resolve(__dirname, 'static_src/js/filter_component.ts'),
        settings: resolve(__dirname, 'static_src/js/settings.ts'),
        stats: resolve(__dirname, 'static_src/js/stats.ts'),
        transactions: resolve(__dirname, 'static_src/js/transactions.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared-[hash].js',
      }
    }
  }
});
