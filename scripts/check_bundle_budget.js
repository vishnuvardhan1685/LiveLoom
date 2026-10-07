const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAX_INITIAL_JS_GZIP_BYTES = 500 * 1024; // 500 KB

const distAssetsDir = path.join(__dirname, '..', 'client', 'dist', 'assets');

if (!fs.existsSync(distAssetsDir)) {
  console.error(`[BUNDLE CHECK] Error: Build output directory not found at ${distAssetsDir}`);
  console.error('Please run "npm run build --prefix client" first.');
  process.exit(1);
}

const files = fs.readdirSync(distAssetsDir);
const jsFiles = files.filter((f) => f.endsWith('.js'));

console.log(`[BUNDLE CHECK] Analyzing ${jsFiles.length} JS chunk(s) in client/dist/assets/...`);

let initialJsGzipTotal = 0;
let failed = false;

jsFiles.forEach((file) => {
  const filePath = path.join(distAssetsDir, file);
  const rawBuf = fs.readFileSync(filePath);
  const rawSizeBytes = rawBuf.length;
  const gzipSizeBytes = zlib.gzipSync(rawBuf).length;

  const rawKb = (rawSizeBytes / 1024).toFixed(2);
  const gzipKb = (gzipSizeBytes / 1024).toFixed(2);

  // Monaco chunk is dynamically loaded; initial JS chunks are index, vendor-react, yjs, EditorPage
  const isMonacoAsyncChunk = file.startsWith('monaco-');

  console.log(`  - ${file}: raw ${rawKb} KB, gzip ${gzipKb} KB ${isMonacoAsyncChunk ? '(async chunk)' : '(initial chunk)'}`);

  if (!isMonacoAsyncChunk) {
    initialJsGzipTotal += gzipSizeBytes;
  }
});

const totalInitialGzipKb = (initialJsGzipTotal / 1024).toFixed(2);
console.log(`\n[BUNDLE CHECK] Total Initial JS Gzipped Size: ${totalInitialGzipKb} KB (Budget: 500.00 KB)`);

if (initialJsGzipTotal > MAX_INITIAL_JS_GZIP_BYTES) {
  console.error(`[BUNDLE CHECK] FAILED: Initial JS gzipped size (${totalInitialGzipKb} KB) exceeds maximum budget of 500 KB!`);
  process.exit(1);
} else {
  console.log(`[BUNDLE CHECK] PASSED: Initial JS size is well within the 500 KB gzipped budget.`);
}
