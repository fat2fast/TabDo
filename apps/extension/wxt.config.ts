import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'TabDo',
    description: 'Personal task reminder companion',
    permissions: ['storage', 'alarms', 'notifications'],
  },
})
