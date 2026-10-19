import { randomBytes } from 'node:crypto'
import { appendFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// This tool is CI-only: never writes or reads hosted UAT/production credentials.
if (process.env.CI !== 'true' || !process.env.GITHUB_ENV ||
    process.env.SUPABASE_URL !== 'http://127.0.0.1:54321') {
  throw new Error('Local purge credential setup is allowed only in GitHub CI against local Supabase')
}

const credential = randomBytes(32).toString('hex')
const envPath = resolve('supabase/functions/.env')

// The Edge Runtime reads this ignored local file at "supabase start".
// File contents must never be committed or printed to workflow logs.
writeFileSync(envPath, 'PURGE_WORKER_SECRET=' + credential + '\n', { mode: 0o600 })

// Subsequent integration-test steps run as separate GitHub Actions processes.
// This runner-local environment file connects them without printing the value.
appendFileSync(process.env.GITHUB_ENV, 'PURGE_WORKER_SECRET=' + credential + '\n')
console.log('Ephemeral purge credential configured for local CI Edge Runtime')
