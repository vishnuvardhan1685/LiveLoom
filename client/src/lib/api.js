import axios from 'axios'

// ─── Axios instance ───────────────────────────────────────────────────────────
// Routes are proxied in dev by vite.config.js to http://localhost:4000
// Server mounts at /auth and /rooms (NO /api prefix)
export const apiClient = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

export const api = apiClient
export default apiClient

// Attach JWT on every request
// Server reads: Authorization: Bearer <token>
// Token field from server response: { token } (not accessToken)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-clear on 401
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ll_token')
      localStorage.removeItem('ll_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
// POST /auth/signup  body: { email, password, name }
//   response: { token, user: { id, email, name } }
// POST /auth/login   body: { email, password }
//   response: { token, user: { id, email, name } }
export const authApi = {
  signup: (email, password, name) =>
    apiClient.post('/auth/signup', { email, password, name }),
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }),
  getMe: () =>
    apiClient.get('/auth/me'),
  updateMe: (data) =>
    apiClient.put('/auth/me', data),
}

// ─── Rooms ────────────────────────────────────────────────────────────────────
// POST /rooms           body: { name, maxUsers? }
//   response: { id, name, ownerId, maxUsers, role }
// GET  /rooms/:id
//   response: { id, name, ownerId, maxUsers, memberCount, role }
// DELETE /rooms/:id     → 204
// POST /rooms/:id/tickets
//   response: { ticket, expiresInSeconds }
// POST /rooms/:id/invites body: { role, expiresAt, maxUses }
//   response: { token, link, role, expiresAt, maxUses }
export const roomsApi = {
  list: () => apiClient.get('/rooms'),
  create: (name, maxUsers) =>
    apiClient.post('/rooms', { name, ...(maxUsers && { maxUsers }) }),
  get: (id) => apiClient.get(`/rooms/${id}`),
  delete: (id) => apiClient.delete(`/rooms/${id}`),
  getTicket: (id) => apiClient.post(`/rooms/${id}/tickets`),
  createInvite: (id, role, expiresAt, maxUses) =>
    apiClient.post(`/rooms/${id}/invites`, { role, expiresAt, maxUses }),
  // Member management
  getMembers: (id) => apiClient.get(`/rooms/${id}/members`),
  patchMemberRole: (roomId, userId, role) =>
    apiClient.patch(`/rooms/${roomId}/members/${userId}`, { role }),
  removeMember: (roomId, userId) =>
    apiClient.delete(`/rooms/${roomId}/members/${userId}`),
}

// ─── Invites ─────────────────────────────────────────────────────────────────
// GET /invites/:token   (auth required)
//   response: { roomId, role }
export const invitesApi = {
  redeem: (token) => apiClient.get(`/invites/${token}`),
}
