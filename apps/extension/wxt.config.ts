import { defineConfig } from 'wxt'
import react from '@wxt-dev/module-react'

export default defineConfig({
  modules: [react()],
  manifest: {
    name: 'Task MVP',
    description: 'Personal task reminder companion',
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: ['https://*.supabase.co/*'],
  },
})
