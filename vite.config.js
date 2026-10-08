import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devFunctionsPlugin } from './server/devFunctions.mjs'

export default defineConfig({
  plugins: [react(), devFunctionsPlugin()],
})
