# 1. Run Unit Tests (Node 22 built-in test runner)
npm test
# Output: 3 tests passed in 245ms

# 2. Verify Client Bundle Size Budget (<500 KB Gzipped)
npm run check:bundle
# Output: Initial JS size 123.26 KB (PASSED)
