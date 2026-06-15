// Shofar Hub — GPU Monitor
// Reads GPU stats and pushes them to Supabase every 5 seconds.

const si = require('systeminformation')
const { execSync } = require('child_process')
const os = require('os')

// ── Supabase credentials (same project as the main app) ──────────────────────
const SUPABASE_URL = 'https://bimulhdifxhwhstdxtas.supabase.co'
const SUPABASE_KEY = 'sb_publishable_6FsfA1OSSOt8LyYGQ1gsBw_LRKtCXAn'
const CHANNEL_ID   = 'gpu_stats'

// ── Push to Supabase REST API (no SDK needed) ─────────────────────────────────
async function push(state) {
  const base = `${SUPABASE_URL}/rest/v1/broadcast_state`
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
  }
  const body = JSON.stringify({ id: CHANNEL_ID, state, updated_at: new Date().toISOString() })
  const res = await fetch(base, { method: 'POST', headers, body })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase error ${res.status}: ${text}`)
  }
}

// ── macOS: read GPU usage via powermetrics ────────────────────────────────────
function macGPUUsage() {
  try {
    const out = execSync('powermetrics --samplers gpu_power -i 500 -n 1 2>/dev/null', { timeout: 4000 }).toString()
    // Apple Silicon: "GPU HW active residency:  12.34%"
    const m = out.match(/GPU HW active residency:\s+([\d.]+)%/)
    if (m) return parseFloat(m[1])
    // Intel Mac: "GPU Active Residency:  12.34%"
    const m2 = out.match(/GPU Active Residency:\s+([\d.]+)%/)
    if (m2) return parseFloat(m2[1])
    return null
  } catch {
    return null
  }
}

// ── macOS: total RAM as proxy for unified memory ──────────────────────────────
function macUnifiedMemoryMB() {
  return Math.round(os.totalmem() / 1024 / 1024)
}

// ── Read GPU stats ─────────────────────────────────────────────────────────────
async function readGPU() {
  const { controllers } = await si.graphics()
  if (!controllers || controllers.length === 0) return null

  const gpu = controllers.find(c =>
    c.vendor && !c.vendor.toLowerCase().includes('intel') && !c.model?.toLowerCase().includes('intel')
  ) ?? controllers[0]

  const isMac = process.platform === 'darwin'

  // On macOS, systeminformation can't get GPU usage — use powermetrics instead
  const usage = gpu.utilizationGpu ?? (isMac ? macGPUUsage() : null)

  // Apple Silicon has no dedicated VRAM — show unified memory total instead
  const vram = gpu.vram || (isMac ? macUnifiedMemoryMB() : null)
  const vramLabel = (!gpu.vram && isMac) ? 'Unified' : null

  return {
    model:       gpu.model        ?? 'Unknown GPU',
    vendor:      gpu.vendor       ?? '',
    vram,
    vramLabel,                               // 'Unified' for Apple Silicon
    vramUsed:    gpu.memoryUsed   ?? null,
    usage,
    temperature: gpu.temperatureGpu ?? null,
    platform:    process.platform,
  }
}

// ── Console display ───────────────────────────────────────────────────────────
function bar(pct, width = 20) {
  if (pct == null) return '—'
  const filled = Math.round((pct / 100) * width)
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + `] ${pct.toFixed(1)}%`
}

function clearLine() { process.stdout.write('\r\x1b[K') }

let ticker = 0
const spin = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']

function display(gpu, pushed) {
  process.stdout.write('\x1b[2J\x1b[H') // clear screen
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SHOFAR HUB  —  GPU Monitor')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (!gpu) {
    console.log('\n  No GPU detected.\n')
  } else {
    console.log(`\n  GPU    ${gpu.model}`)
    console.log(`  VRAM   ${gpu.vram != null ? gpu.vram + ' MB' : '—'}`)
    console.log(`  Usage  ${bar(gpu.usage)}`)
    if (gpu.vramUsed != null && gpu.vram != null) {
      console.log(`  V.Mem  ${bar((gpu.vramUsed / gpu.vram) * 100)} (${gpu.vramUsed} MB used)`)
    }
    if (gpu.temperature != null) {
      console.log(`  Temp   ${gpu.temperature}°C`)
    }
    if (gpu.usage == null && process.platform === 'darwin') {
      console.log('\n  ⚠  GPU usage % requires running with sudo on macOS.')
      console.log('     VRAM and model info are still being sent.')
    }
    console.log()
  }
  const status = pushed ? '✓  Sending to Shofar Hub' : '…  Connecting'
  console.log(`  ${spin[ticker % spin.length]}  ${status}`)
  console.log('\n  Press Ctrl+C to stop.\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  ticker++
}

// ── Main loop ─────────────────────────────────────────────────────────────────
let pushed = false

async function tick() {
  try {
    const gpu = await readGPU()
    if (gpu) await push(gpu)
    pushed = true
    display(gpu, true)
  } catch (err) {
    pushed = false
    process.stdout.write('\x1b[2J\x1b[H')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  SHOFAR HUB  —  GPU Monitor')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n  ✗  Error: ' + err.message)
    console.log('     Retrying in 5 seconds...\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }
}

console.log('Starting GPU Monitor...')
tick()
setInterval(tick, 5000)
