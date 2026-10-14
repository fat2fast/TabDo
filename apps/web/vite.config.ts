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

export default defineConfig(({ mode }) => {
  if (process.env.TABDO_EXPECT_PRODUCTION_BUILD === '1') {
    if (mode !== 'production') {
      throw new Error(`[build:safety] TABDO_EXPECT_PRODUCTION_BUILD=1 requires Vite mode 'production', got '${mode}'`)
    }
    if (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') {
      throw new Error(`[build:safety] TABDO_EXPECT_PRODUCTION_BUILD=1 requires NODE_ENV 'production', got '${process.env.NODE_ENV}'`)
    }
  }

  const observabilityClientConfig =
    process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG ||
    process.env.REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG ||
    ''

  const observabilityBasePath =
    process.env.VERCEL_OBSERVABILITY_BASEPATH ||
    process.env.REACT_APP_VERCEL_OBSERVABILITY_BASEPATH ||
    ''

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(commitHash),
      __DEPLOY_DATE__: JSON.stringify(deployDate),
      'process.env.REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG': JSON.stringify(observabilityClientConfig),
      'process.env.REACT_APP_VERCEL_OBSERVABILITY_BASEPATH': JSON.stringify(observabilityBasePath),
    },
  }
})
