import { ref } from 'vue'
import { api } from './api'
export const authenticated = ref(false)
export const adminUsername = ref('')
export const authConfigured = ref(false)
let csrf = ''
interface AuthSession { authenticated: boolean; username: string | null; configured: boolean; csrf: string | null }
function apply(session: AuthSession) {
  authenticated.value = session.authenticated
  adminUsername.value = session.username || ''
  authConfigured.value = session.configured
  csrf = session.csrf || ''
}
api.interceptors.request.use(config => {
  if (!['get', 'head', 'options'].includes(config.method || 'get')) {
    config.headers.set('X-Arena-Request', '1')
    if (csrf) config.headers.set('X-CSRF-Token', csrf)
  }
  return config
})
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !String(error.config?.url).includes('/auth/login')) {
    authenticated.value = false
    csrf = ''
  }
  return Promise.reject(error)
})
export async function restoreSession() {
  try { apply((await api.get('/auth/session')).data.data) }
  catch { authenticated.value = false; csrf = '' }
}
export async function login(username: string, password: string) {
  apply((await api.post('/auth/login', { username, password })).data.data)
}
export async function logout() {
  await api.post('/auth/logout')
  authenticated.value = false
  adminUsername.value = ''
  csrf = ''
}
