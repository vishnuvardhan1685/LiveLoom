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

async function runSuite(label = 'BASELINE') {
  const normLabel = label.toLowerCase()
  console.log(`\n======================================================`)
  console.log(`   LIVELOOM BENCHMARK SUITE - EXECUTING ${label}`)
  console.log(`======================================================\n`)

  const sysInfo = getSystemInfo()
  console.log('System Specs:', sysInfo)

  const resultsDir = path.join(__dirname, 'results')
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true })
  }

  const safeRun = async (fn, name) => {
    try {
      console.log(`\n--> Running ${name}...`)
      const res = await fn()
      console.log(`[COMPLETED] ${name}`)
      return res
    } catch (err) {
      console.error(`[FAILED] ${name}:`, err.message || err)
      return { error: err.message || String(err) }
    }
  }

  const runs = []
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- STARTING ITERATION ${i} OF 3 (${label}) ---`)
    const testA = await safeRun(runTestA, 'Test A (Sync Latency)')
    const testB = await safeRun(runTestB, 'Test B (Scale)')
    const testC = await safeRun(runTestC, 'Test C (Convergence)')
    const testD = await safeRun(runTestD, 'Test D (Offline Reconnect)')
    const testE = await safeRun(runTestE, 'Test E (Late Join)')
    const testF = await safeRun(runTestF, 'Test F (Cross Instance)')
    const testG = await safeRun(runTestG, 'Test G (Persistence Recovery)')
    const testH = await safeRun(runTestH, 'Test H (Memory Lifecycle)')
    const testI = await safeRun(runTestI, 'Test I (Awareness Traffic)')
    const testJ = await safeRun(runTestJ, 'Test J (REST API)')
    const testK = await safeRun(runTestK, 'Test K (Security Load)')
    const testL = await safeRun(runTestL, 'Test L (Frontend Lighthouse)')

    const runData = {
      runIndex: i,
      label,
      timestamp: new Date().toISOString(),
      sysInfo,
      tests: { testA, testB, testC, testD, testE, testF, testG, testH, testI, testJ, testK, testL },
    }

    runs.push(runData.tests)

    const runFilePath = path.join(resultsDir, `${normLabel}-run${i}.json`)
    fs.writeFileSync(runFilePath, JSON.stringify(runData, null, 2))
    console.log(`Saved raw run ${i} to ${runFilePath}`)
  }

  const resultData = {
    label,
    timestamp: new Date().toISOString(),
    sysInfo,
    medianRun: runs[1] || runs[0],
    rawRuns: runs,
  }

  const filename = path.join(__dirname, `${normLabel}_results.json`)
  fs.writeFileSync(filename, JSON.stringify(resultData, null, 2))
  console.log(`\n======================================================`)
  console.log(`   SUCCESSFULLY SAVED RESULTS TO ${filename}`)
  console.log(`======================================================\n`)

  return resultData
}

if (require.main === module) {
  const label = process.argv[2] ? process.argv[2].toUpperCase() : 'BASELINE'
  runSuite(label).catch(console.error)
}

module.exports = { runSuite }
