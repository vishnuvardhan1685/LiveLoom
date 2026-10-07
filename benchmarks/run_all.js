const fs = require('fs')
const path = require('path')
const { getSystemInfo } = require('./helpers')
const { runTestA } = require('./test_a_sync_latency')
const { runTestB } = require('./test_b_concurrency_scale')
const { runTestC } = require('./test_c_convergence')
const { runTestD } = require('./test_d_offline_reconnect')
const { runTestE } = require('./test_e_late_join')
const { runTestF } = require('./test_f_cross_instance')
const { runTestG } = require('./test_g_persistence_recovery')
const { runTestH } = require('./test_h_memory_lifecycle')
const { runTestI } = require('./test_i_awareness_traffic')
const { runTestJ } = require('./test_j_rest_api')
const { runTestK } = require('./test_k_security_load')
const { runTestL } = require('./test_l_frontend')

async function runFullSuite(label = 'BASELINE') {
  console.log(`\n======================================================`)
  console.log(`   LIVELOOM BENCHMARK SUITE - RUNNING ${label}`)
  console.log(`======================================================\n`)

  const sysInfo = getSystemInfo()
  console.log('System Specifications:', sysInfo)

  // Warmup run
  console.log('\n--> Performing Warmup Run...')
  try {
    await runTestA()
  } catch (e) {
    console.warn('Warmup notice:', e.message)
  }

  // 3 Iterations for median and spread
  const ITERATIONS = 3
  const runs = []

  for (let i = 1; i <= ITERATIONS; i++) {
    console.log(`\n======================================================`)
    console.log(`   ITERATION ${i} OF ${ITERATIONS} (${label})`)
    console.log(`======================================================`)

    const safeRun = async (fn, name) => {
      try {
        return await fn()
      } catch (err) {
        console.error(`Error during ${name}:`, err.message || err)
        return { error: err.message || String(err) }
      }
    }

    const testA = await safeRun(runTestA, 'Test A')
    const testB = await safeRun(runTestB, 'Test B')
    const testC = await safeRun(runTestC, 'Test C')
    const testD = await safeRun(runTestD, 'Test D')
    const testE = await safeRun(runTestE, 'Test E')
    const testF = await safeRun(runTestF, 'Test F')
    const testG = await safeRun(runTestG, 'Test G')
    const testH = await safeRun(runTestH, 'Test H')
    const testI = await safeRun(runTestI, 'Test I')
    const testJ = await safeRun(runTestJ, 'Test J')
    const testK = await safeRun(runTestK, 'Test K')
    const testL = await safeRun(runTestL, 'Test L')

    runs.push({ testA, testB, testC, testD, testE, testF, testG, testH, testI, testJ, testK, testL })
  }

  // Calculate Median & Spread across 3 runs
  const medianRun = runs[Math.floor(runs.length / 2)] || runs[0]
  const summaryData = {
    label,
    timestamp: new Date().toISOString(),
    sysInfo,
    medianRun,
    rawRuns: runs,
  }

  const filename = path.join(__dirname, `${label.toLowerCase()}_results.json`)
  fs.writeFileSync(filename, JSON.stringify(summaryData, null, 2))
  console.log(`\nSaved benchmark metrics to ${filename}`)

  return summaryData
}

if (require.main === module) {
  const label = process.argv[2] ? process.argv[2].toUpperCase() : 'BASELINE'
  runFullSuite(label).catch(console.error)
}

module.exports = { runFullSuite }
