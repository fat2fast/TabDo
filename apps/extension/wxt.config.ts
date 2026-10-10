import { defineConfig } from 'wxt'

try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(process as any).loadEnvFile?.()
} catch {
  // Ignore missing .env file
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required for extension manifest generation')
}

let origin: string
try {
  origin = new URL(supabaseUrl).origin
} catch {
  throw new Error(`Invalid VITE_SUPABASE_URL: ${supabaseUrl}`)
}

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'TabDo',
    description: 'Personal task reminder companion',
    permissions: [
      'storage',
      'alarms',
      'notifications',
      'contextMenus',
      'scripting',
      'activeTab',
    ],
    host_permissions: [`${origin}/*`],
    optional_host_permissions: ['*://*/*', 'https://*/*', 'http://*/*'],
  },
})
