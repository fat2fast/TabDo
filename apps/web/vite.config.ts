import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function getGitCommitHash(): string {
  if (process.env.VITE_COMMIT_HASH) {
    return process.env.VITE_COMMIT_HASH
  }
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return '9e660dc'
  }
}

function getDeployDate(): string {
  if (process.env.VITE_DEPLOY_DATE) {
    return process.env.VITE_DEPLOY_DATE
  }
  try {
    const gitDate = execSync('git log -1 --format="%cd" --date=format:"%d/%m/%Y"', { encoding: 'utf-8' }).trim()
    if (gitDate) return gitDate
  } catch {}
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const commitHash = getGitCommitHash()
const deployDate = getDeployDate()

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(commitHash),
    __DEPLOY_DATE__: JSON.stringify(deployDate),
  },
})
