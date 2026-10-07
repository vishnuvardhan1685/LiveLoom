/**
 * Utility to throttle awareness cursor updates.
 * Coalesces high-frequency mouse/cursor movements into periodic updates.
 */
export function createAwarenessThrottler(awareness, throttleMs = 50) {
  let lastTime = 0;
  let timer = null;
  let pendingValue = null;

  return function updateAwareness(field, value, forceImmediate = false) {
    const now = Date.now();

    if (forceImmediate || throttleMs <= 0 || now - lastTime >= throttleMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastTime = now;
      pendingValue = null;
      awareness.setLocalStateField(field, value);
    } else {
      pendingValue = value;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          lastTime = Date.now();
          if (pendingValue !== null) {
            awareness.setLocalStateField(field, pendingValue);
            pendingValue = null;
          }
        }, throttleMs - (now - lastTime));
      }
    }
  };
}
