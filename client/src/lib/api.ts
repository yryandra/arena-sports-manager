import axios from 'axios'
import { ref } from 'vue'
import type { Athlete, Competition, Result, Metadata, Resource } from '../types'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000, withCredentials: true })
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      (error.code === 'ECONNABORTED'
        ? 'The server took too long. Please try again.'
        : 'The workspace is temporarily unavailable. Please try again shortly.')
    )
  }
  return 'Something went wrong. Please try again.'
}
export function useSportsData() {
  const athletes = ref<Athlete[]>([])
  const events = ref<Competition[]>([])
  const results = ref<Result[]>([])
  const meta = ref<Metadata>({ sports: [], countries: [], mode: 'demo' })
  const loading = ref(true)
  const error = ref('')
  async function refresh() {
    loading.value = true
    error.value = ''
    try {
      const responses = await Promise.all([
        api.get('/athletes'),
        api.get('/events'),
        api.get('/results'),
        api.get('/meta'),
      ])
      athletes.value = responses[0]!.data.data
      events.value = responses[1]!.data.data
      results.value = responses[2]!.data.data
      meta.value = responses[3]!.data.data
    } catch (failure) {
      error.value = errorMessage(failure)
    } finally {
      loading.value = false
    }
  }
  async function persist(kind: Resource, payload: object, id?: string) {
    if (id) await api.patch(`/${kind}/${id}`, payload)
    else await api.post(`/${kind}`, payload)
    await refresh()
  }
  async function remove(kind: Resource, id: string) {
    await api.delete(`/${kind}/${id}`)
    await refresh()
  }
  return { athletes, events, results, meta, loading, error, refresh, persist, remove }
}
