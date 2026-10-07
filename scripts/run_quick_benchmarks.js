process.env.QUICK_MODE = 'true';

const { runTestA } = require('../benchmarks/test_a_sync_latency');
const { runTestC } = require('../benchmarks/test_c_convergence');
const { runTestK } = require('../benchmarks/test_k_security_load');

async function main() {
  console.log('=====================================================');
  console.log('   RUNNING QUICK CI BENCHMARK TESTS (A, C, K)');
  console.log('=====================================================');

  console.log('\n--> Running Test A (Sync Latency)...');
  const resA = await runTestA();
  console.log('Test A Results:', JSON.stringify(resA, null, 2));

  console.log('\n--> Running Test C (Convergence)...');
  const resC = await runTestC();
  if (!resC || !resC.passed) {
    console.error('FAILED: Test C convergence check failed!');
    process.exit(1);
  }

  console.log('\n--> Running Test K (Security & Load)...');
  const resK = await runTestK();
  if (
    !resK.viewerEditsRejected ||
    !resK.oversizedPayloadRejected ||
    !resK.messageFloodRateLimited ||
    !resK.otherClientsUnaffected
  ) {
    console.error('FAILED: Test K security or isolation assertion failed!');
    console.error('Test K breakdown:', resK);
    process.exit(1);
  }

  console.log('\n=====================================================');
  console.log('   ALL QUICK BENCHMARK TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================');
}

main().catch((err) => {
  console.error('ERROR in quick benchmark suite:', err);
  process.exit(1);
});
