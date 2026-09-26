function timeStamp() {
    return new Date().toISOString();
}

module.exports = {
    info: (msg, meta) => console.log(`[INFO] [${timeStamp()}] ${msg}`, meta || ''),
    warn: (msg, meta) => console.warn(`[WARN] [${timeStamp()}] ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`[ERROR] [${timeStamp()}] ${msg}`, meta || ''),
};