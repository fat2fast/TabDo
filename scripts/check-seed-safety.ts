import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface SeedSafetyReport {
  ok: boolean
  errors: string[]
}

export function checkSeedSafety(repoRoot: string): SeedSafetyReport {
  const errors: string[] = []

  // 1. Check supabase/config.toml
  const configPath = path.join(repoRoot, 'supabase', 'config.toml')
  if (!fs.existsSync(configPath)) {
    errors.push('supabase/config.toml not found')
  } else {
    const configContent = fs.readFileSync(configPath, 'utf8')
    const seedBlockMatch = configContent.match(/\[db\.seed\][\s\S]*?(?=\n\[|$)/)
    if (!seedBlockMatch) {
      errors.push('[db.seed] block missing in supabase/config.toml')
    } else {
      const seedBlock = seedBlockMatch[0]
      if (!/enabled\s*=\s*false/.test(seedBlock)) {
        errors.push('[db.seed] must have enabled = false in supabase/config.toml')
      }
      if (!/sql_paths\s*=\s*\[\s*\]/.test(seedBlock)) {
        errors.push('[db.seed] must have sql_paths = [] in supabase/config.toml')
      }
    }
  }

  // 2. Check supabase/seed.sql does NOT exist
  const seedSqlPath = path.join(repoRoot, 'supabase', 'seed.sql')
  if (fs.existsSync(seedSqlPath)) {
    errors.push('supabase/seed.sql must not exist (seed must be opt-in via local fixture)')
  }

  // 3. Check migrations do NOT contain seed fixtures or fixture paths
  const migrationsDir = path.join(repoRoot, 'supabase', 'migrations')
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
    for (const f of files) {
      if (f.endsWith('.sql')) {
        const content = fs.readFileSync(path.join(migrationsDir, f), 'utf8')
        if (content.includes('local-demo.sql') || content.includes('./seeds/')) {
          errors.push(`Migration ${f} contains references to local seed fixtures`)
        }
      }
    }
  }

  // 4. Check scripts/reset-local-db.ts wrapper invokes only --local
  const wrapperPath = path.join(repoRoot, 'scripts', 'reset-local-db.ts')
  if (!fs.existsSync(wrapperPath)) {
    errors.push('scripts/reset-local-db.ts missing')
  } else {
    const wrapperContent = fs.readFileSync(wrapperPath, 'utf8')
    if (!wrapperContent.includes("'--local'") && !wrapperContent.includes('"--local"')) {
      errors.push('scripts/reset-local-db.ts must explicitly use --local flag')
    }
    if (wrapperContent.includes("'--linked'") || wrapperContent.includes('"--linked"')) {
      errors.push('scripts/reset-local-db.ts must not contain --linked flag')
    }
    if (wrapperContent.includes("'--db-url'") || wrapperContent.includes('"--db-url"')) {
      errors.push('scripts/reset-local-db.ts must not accept or contain --db-url flag')
    }
  }

  // 5. Check workflows: deploy-uat.yml must NOT invoke db reset, seed scripts or --include-seed
  const workflowsDir = path.join(repoRoot, '.github', 'workflows')
  if (fs.existsSync(workflowsDir)) {
    const workflowFiles = fs.readdirSync(workflowsDir)
    for (const wf of workflowFiles) {
      if (wf.endsWith('.yml') || wf.endsWith('.yaml')) {
        const wfContent = fs.readFileSync(path.join(workflowsDir, wf), 'utf8')
        if (wf === 'deploy-uat.yml') {
          if (/db\s+reset/i.test(wfContent)) {
            errors.push(`${wf} must not execute db reset`)
          }
          if (/db:reset:local/i.test(wfContent)) {
            errors.push(`${wf} must not invoke db:reset:local`)
          }
          if (/--include-seed/i.test(wfContent)) {
            errors.push(`${wf} must not use --include-seed`)
          }
          if (/--sql-paths/i.test(wfContent)) {
            errors.push(`${wf} must not use --sql-paths`)
          }
          if (/local-demo\.sql/i.test(wfContent)) {
            errors.push(`${wf} must not reference local-demo.sql`)
          }
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

export function runCheckSeedSafety(): void {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDir, '..')

  const report = checkSeedSafety(repoRoot)
  if (!report.ok) {
    console.error('[seed:local:safety] Safety checks failed:')
    for (const err of report.errors) {
      console.error(`  - ${err}`)
    }
    process.exit(1)
  }

  console.log('[seed:local:safety] PASS: Database seed safety verification succeeded.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCheckSeedSafety()
}
