import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface CheckUatBuildConfigOptions {
  repoRoot?: string
  projectJsonPath?: string
  envLocalPath?: string
  expectedProjectId?: string
  expectedProjectRef?: string
  customHostname?: string
}

export interface UatBuildConfigReport {
  ok: boolean
  errors: string[]
  info: string[]
}

export function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }
  return result
}

export function checkUatBuildConfig(options: CheckUatBuildConfigOptions = {}): UatBuildConfigReport {
  const errors: string[] = []
  const info: string[] = []

  const repoRoot = options.repoRoot || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const projectJsonPath =
    options.projectJsonPath ||
    [
      path.join(repoRoot, 'apps', 'web', '.vercel', 'project.json'),
      path.join(repoRoot, '.vercel', 'project.json'),
    ].find((p) => fs.existsSync(p)) ||
    path.join(repoRoot, 'apps', 'web', '.vercel', 'project.json')

  const envLocalPath =
    options.envLocalPath ||
    [
      path.join(repoRoot, 'apps', 'web', '.vercel', '.env.production.local'),
      path.join(repoRoot, '.vercel', '.env.production.local'),
    ].find((p) => fs.existsSync(p)) ||
    path.join(repoRoot, 'apps', 'web', '.vercel', '.env.production.local')

  const expectedProjectId = options.expectedProjectId ?? process.env.VERCEL_PROJECT_ID
  const expectedProjectRef = options.expectedProjectRef ?? process.env.SUPABASE_UAT_PROJECT_REF
  const customHostname = options.customHostname ?? process.env.SUPABASE_UAT_CUSTOM_HOSTNAME

  // 1. Verify project.json
  if (!fs.existsSync(projectJsonPath)) {
    errors.push(`Vercel project configuration not found at ${projectJsonPath}`)
  } else {
    try {
      const content = fs.readFileSync(projectJsonPath, 'utf8')
      const parsed = JSON.parse(content)
      const projectId = parsed.projectId || parsed.id
      if (!projectId) {
        errors.push(`Missing projectId in ${projectJsonPath}`)
      } else {
        info.push(`Vercel project ID verified (length: ${projectId.length})`)
        if (expectedProjectId && projectId !== expectedProjectId) {
          errors.push(`Vercel projectId mismatch: expected '${expectedProjectId}', found different project ID`)
        }
      }
    } catch (err: any) {
      errors.push(`Failed to parse ${projectJsonPath}: ${err.message}`)
    }
  }

  // 2. Verify .env.production.local
  if (!fs.existsSync(envLocalPath)) {
    errors.push(`Vercel pulled environment file not found at ${envLocalPath}`)
  } else {
    try {
      const content = fs.readFileSync(envLocalPath, 'utf8')
      const envVars = parseDotenv(content)

      // Supabase URL check
      const supabaseUrl = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL
      if (!supabaseUrl) {
        errors.push('Missing VITE_SUPABASE_URL in pulled UAT environment')
      } else {
        if (!supabaseUrl.startsWith('https://')) {
          errors.push('VITE_SUPABASE_URL must use HTTPS protocol')
        }
        if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(supabaseUrl)) {
          errors.push('VITE_SUPABASE_URL must not target local database')
        }
        if (supabaseUrl.includes('.invalid')) {
          errors.push('VITE_SUPABASE_URL contains placeholder domain (.invalid)')
        }

        if (customHostname) {
          if (!supabaseUrl.includes(customHostname)) {
            errors.push(`VITE_SUPABASE_URL does not match custom UAT hostname '${customHostname}'`)
          }
        } else if (expectedProjectRef) {
          const expectedTarget = `https://${expectedProjectRef}.supabase.co`
          if (supabaseUrl !== expectedTarget) {
            errors.push(`VITE_SUPABASE_URL mismatch: expected '${expectedTarget}', got '${supabaseUrl}'`)
          }
        }
        info.push('VITE_SUPABASE_URL protocol and target verified')
      }

      // Supabase Key check
      const pubKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.VITE_SUPABASE_ANON_KEY
      if (!pubKey || pubKey.trim() === '') {
        errors.push('Missing VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY in pulled UAT environment')
      } else {
        if (/placeholder|ci-placeholder|\.invalid/i.test(pubKey)) {
          errors.push('Public Supabase key is a placeholder value')
        } else {
          info.push(`Public Supabase key present and valid (length: ${pubKey.length})`)
        }
      }

      // NODE_ENV check
      if (envVars.NODE_ENV && envVars.NODE_ENV !== 'production') {
        errors.push(`NODE_ENV in pulled UAT environment is '${envVars.NODE_ENV}' (expected 'production')`)
      }
    } catch (err: any) {
      errors.push(`Failed to read/parse ${envLocalPath}: ${err.message}`)
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    info,
  }
}

export function runCheckUatBuildConfig(): void {
  const report = checkUatBuildConfig()
  if (!report.ok) {
    console.error('[uat:build-config] Validation failed:')
    for (const err of report.errors) {
      console.error(`  - ${err}`)
    }
    process.exit(1)
  }

  console.log('[uat:build-config] PASS: UAT build configuration verified successfully.')
  for (const line of report.info) {
    console.log(`  - ${line}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCheckUatBuildConfig()
}
