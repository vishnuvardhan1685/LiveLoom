const PALETTE = ['#34d399', '#f59e0b', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#22d3ee', '#f87171']

export function colorForUserId(userId) {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function initialsFor(name) {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}