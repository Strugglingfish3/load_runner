import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        manager: resolve(__dirname, 'manager.html'),
        timer: resolve(__dirname, 'timer.html'),
      },
    },
  },
})