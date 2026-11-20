<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from './components/AppIcon.vue'
import CompetitionCard from './components/CompetitionCard.vue'
import ResultsTable from './components/ResultsTable.vue'
import RecordForm from './components/RecordForm.vue'
import AdminLogin from './components/AdminLogin.vue'
import { authenticated, adminUsername, restoreSession, logout } from './lib/auth'
import { useSportsData, errorMessage } from './lib/api'
import {
  downloadCsv,
  formatDate,
  initials,
  localDay,
  rank,
  sportIcon,
  sportImage,
} from './lib/format'
import type { Athlete, Competition, FormState, Page, Resource } from './types'

const { athletes, events, results, meta, loading, error, refresh, persist, remove } =
  useSportsData()
const navigation: { id: Page; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'athletes', label: 'Athletes', icon: 'users' },
  { id: 'competitions', label: 'Competitions', icon: 'trophy' },
  { id: 'results', label: 'Results', icon: 'chart' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar' },
  { id: 'reports', label: 'Reports', icon: 'file' },
]
const readPage = (): Page =>
  navigation.find((item) => item.id === window.location.hash.slice(1))?.id || 'overview'
const page = ref<Page>(readPage())
const mobileNav = ref(false)
const menu = ref<'notifications' | 'profile' | null>(null)
const form = ref<FormState | null>(null)
const showLogin = ref(false)
const query = ref('')
const sportFilter = ref('')
const statusFilter = ref('')
const countryFilter = ref('')
const eventTab = ref('All competitions')
const resultEvent = ref('')
const athletePage = ref(1)
const pageSize = 8
const sort = ref('name')
const scheduleDay = ref('Today')
const scheduleDate = ref(localDay())
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout>
const overlay = ref<'competition' | 'help' | 'search' | 'delete' | null>(null)
const dialog = ref<HTMLDialogElement>()
const selectedEvent = ref<Competition | null>(null)
const globalQuery = ref('')
const searchInput = ref<HTMLInputElement>()
const deletion = ref<{ kind: Resource; id: string; label: string } | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const title = computed(() => navigation.find((item) => item.id === page.value)?.label || 'Overview')
const today = localDay()
const currentDate = new Date().toLocaleDateString('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Riyadh',
})
const liveEvents = computed(() => events.value.filter((event) => event.status === 'Live'))
const nations = computed(() => [...new Set(athletes.value.map((athlete) => athlete.country))])
const activeAthletes = computed(() =>
  athletes.value.filter((athlete) => athlete.status === 'Active'),
)
const published = computed(() => results.value.filter((result) => result.status === 'Published'))
const stats = computed(() => [
  {
    label: 'Registered athletes',
    value: athletes.value.length,
    note: `${activeAthletes.value.length} active athletes`,
    icon: 'users',
    page: 'athletes' as Page,
    color: 'green',
  },
  {
    label: 'Competitions',
    value: events.value.length,
    note: `${liveEvents.value.length} competitions live now`,
    icon: 'trophy',
    page: 'competitions' as Page,
    color: 'purple',
  },
  {
    label: 'Participating nations',
    value: nations.value.length,
    note: 'One world. United by sport.',
    icon: 'globe',
    page: 'reports' as Page,
    color: 'blue',
  },
  {
    label: 'Published results',
    value: published.value.length,
    note: `${results.value.filter((result) => result.status === 'Provisional').length} awaiting confirmation`,
    icon: 'medal',
    page: 'results' as Page,
    color: 'orange',
  },
])
const filteredEvents = computed(() =>
  events.value
    .filter(
      (event) =>
        (!query.value ||
          `${event.name} ${event.location} ${event.discipline}`
            .toLowerCase()
            .includes(query.value.toLowerCase())) &&
        (!sportFilter.value || event.sport === sportFilter.value) &&
        (eventTab.value === 'All competitions' ||
          event.status ===
            (
              { Live: 'Live', Upcoming: 'Scheduled', Completed: 'Completed' } as Record<
                string,
                string
              >
            )[eventTab.value]),
    )
    .sort(
      (a, b) =>
        ({ Live: 0, Scheduled: 1, Completed: 2 })[a.status] -
          { Live: 0, Scheduled: 1, Completed: 2 }[b.status] ||
        `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    ),
)
const filteredAthletes = computed(() =>
  athletes.value
    .filter(
      (athlete) =>
        (!query.value ||
          `${athlete.name} ${athlete.country} ${athlete.sport}`
            .toLowerCase()
            .includes(query.value.toLowerCase())) &&
        (!sportFilter.value || athlete.sport === sportFilter.value) &&
        (!statusFilter.value || athlete.status === statusFilter.value) &&
        (!countryFilter.value || athlete.country === countryFilter.value),
    )
    .sort((a, b) =>
      sort.value === 'recent'
        ? b.createdAt.localeCompare(a.createdAt)
        : sort.value === 'age'
          ? a.age - b.age
          : a.name.localeCompare(b.name),
    ),
)
const athletePages = computed(() =>
  Math.max(1, Math.ceil(filteredAthletes.value.length / pageSize)),
)
const pagedAthletes = computed(() =>
  filteredAthletes.value.slice((athletePage.value - 1) * pageSize, athletePage.value * pageSize),
)
const filteredResults = computed(() =>
  results.value
    .filter((result) => {
      const athlete = athletes.value.find((item) => item._id === result.athleteId)
      const event = events.value.find((item) => item._id === result.eventId)
      return (
        (!resultEvent.value || result.eventId === resultEvent.value) &&
        (!statusFilter.value || result.status === statusFilter.value) &&
        (!sportFilter.value || event?.sport === sportFilter.value) &&
        (!query.value ||
          `${athlete?.name} ${event?.name}`.toLowerCase().includes(query.value.toLowerCase()))
      )
    })
    .sort((a, b) => {
      if (a.eventId === b.eventId)
        return (
          rank(a, results.value, findEvent(a.eventId)) -
          rank(b, results.value, findEvent(b.eventId))
        )
      return b.createdAt.localeCompare(a.createdAt)
    }),
)
const recentResults = computed(() =>
  [...published.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4),
)
const dayEvents = computed(() =>
  events.value
    .filter((event) => event.date === (scheduleDay.value === 'Today' ? today : localDay(1)))
    .sort((a, b) => a.time.localeCompare(b.time)),
)
const scheduleEvents = computed(() =>
  events.value
    .filter(
      (event) =>
        (!scheduleDate.value || event.date === scheduleDate.value) &&
        (!sportFilter.value || event.sport === sportFilter.value),
    )
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
)
const countryStats = computed(() =>
  nations.value
    .map((name) => ({
      name,
      ...meta.value.countries.find((country) => country.name === name),
      count: athletes.value.filter((athlete) => athlete.country === name).length,
      gold: published.value.filter(
        (result) =>
          rank(result, published.value, findEvent(result.eventId)) === 1 &&
          findAthlete(result.athleteId)?.country === name,
      ).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
)
const sportStats = computed(() =>
  meta.value.sports.map((sport) => ({
    name: sport,
    count: athletes.value.filter((athlete) => athlete.sport === sport).length,
    events: events.value.filter((event) => event.sport === sport).length,
  })),
)
const searchAthletes = computed(() =>
  athletes.value
    .filter((athlete) =>
      `${athlete.name} ${athlete.country}`.toLowerCase().includes(globalQuery.value.toLowerCase()),
    )
    .slice(0, 5),
)
const searchEvents = computed(() =>
  events.value
    .filter((event) =>
      `${event.name} ${event.sport}`.toLowerCase().includes(globalQuery.value.toLowerCase()),
    )
    .slice(0, 4),
)
const selectedResults = computed(() =>
  results.value
    .filter((result) => result.eventId === selectedEvent.value?._id)
    .sort(
      (a, b) =>
        rank(a, results.value, selectedEvent.value || undefined) -
        rank(b, results.value, selectedEvent.value || undefined),
    ),
)
const findAthlete = (id: string) => athletes.value.find((athlete) => athlete._id === id)
const findEvent = (id: string) => events.value.find((event) => event._id === id)
const country = (name: string) => meta.value.countries.find((item) => item.name === name)
function navigate(target: Page) {
  window.location.hash = target
  page.value = target
  mobileNav.value = false
  menu.value = null
}
function focusMain() {
  document.getElementById('main-content')?.focus()
}
function showAllSchedule() {
  scheduleDate.value = ''
  sportFilter.value = ''
}
function recordForSelectedCompetition() {
  const eventId = selectedEvent.value?._id
  navigate('results')
  openForm({ kind: 'results', eventId })
}
function exploreAthletes() {
  closeOverlay()
  navigate('athletes')
}
function handleHash() {
  page.value = readPage()
  mobileNav.value = false
}
function notify(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 4500)
}
function openForm(state: FormState) {
  closeOverlay()
  menu.value = null
  if (!authenticated.value) { showLogin.value = true; return }
  form.value = state
}
function beginLogin() { closeOverlay(); menu.value = null; showLogin.value = true }
function openSearchAthlete(athlete: Athlete) {
  if (authenticated.value) return openForm({ kind: 'athletes', record: athlete })
  closeOverlay()
  navigate('athletes')
  nextTick(() => { query.value = athlete.name })
}
function signedIn() { showLogin.value = false; notify('Welcome back. Administrator editing is enabled.') }
async function signOut() {
  try { await logout(); form.value = null; menu.value = null; closeOverlay(); notify('Signed out. You can continue browsing.') }
  catch (failure) { notify(errorMessage(failure)) }
}
function openCompetition(event: Competition) {
  selectedEvent.value = event
  overlay.value = 'competition'
  menu.value = null
}
function closeOverlay() {
  if (deleting.value) return
  dialog.value?.close()
  overlay.value = null
}
function requestDelete(kind: Resource, id: string, label: string) {
  form.value = null
  deletion.value = { kind, id, label }
  deleteError.value = ''
  overlay.value = 'delete'
}
async function confirmDelete() {
  if (!deletion.value) return
  deleting.value = true
  try {
    await remove(deletion.value.kind, deletion.value.id)
    deleting.value = false
    closeOverlay()
    notify('Record deleted successfully.')
  } catch (failure) {
    deleteError.value = errorMessage(failure)
  } finally {
    deleting.value = false
  }
}
function saved() {
  form.value = null
  notify('Your changes have been saved.')
}
function clearFilters() {
  query.value = ''
  sportFilter.value = ''
  statusFilter.value = ''
  countryFilter.value = ''
  resultEvent.value = ''
  eventTab.value = 'All competitions'
}
function exportAthletes() {
  downloadCsv('arena-athletes.csv', [
    ['Name', 'Country', 'Sport', 'Age', 'Status'],
    ...filteredAthletes.value.map((athlete) => [
      athlete.name,
      athlete.country,
      athlete.sport,
      athlete.age,
      athlete.status,
    ]),
  ])
  notify('Athlete report downloaded.')
}
function exportResults() {
  downloadCsv('arena-results.csv', [
    ['Competition', 'Discipline', 'Athlete', 'Country', 'Place', 'Performance', 'Unit', 'Status'],
    ...filteredResults.value.map((result) => {
      const event = findEvent(result.eventId)
      const athlete = findAthlete(result.athleteId)
      return [
        event?.name || '',
        event?.discipline || '',
        athlete?.name || '',
        athlete?.country || '',
        rank(result, results.value, event),
        result.performance,
        event?.unit || '',
        result.status,
      ]
    }),
  ])
  notify('Results report downloaded.')
}
function exportCompetitions() {
  downloadCsv('arena-competitions.csv', [
    ['Competition', 'Sport', 'Date', 'Time (AST)', 'Venue', 'Status', 'Entries', 'Capacity'],
    ...events.value.map((event) => [
      event.name,
      event.sport,
      event.date,
      event.time,
      event.location,
      event.status,
      event.participants.length,
      event.capacity,
    ]),
  ])
  notify('Competition report downloaded.')
}
function handleKeys(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    if (!form.value) {
      overlay.value = 'search'
      menu.value = null
    }
  }
  if (event.key === 'Escape') {
    menu.value = null
    mobileNav.value = false
  }
}
watch(page, () => {
  clearFilters()
  athletePage.value = 1
  window.scrollTo({ top: 0, behavior: 'instant' })
  document.title = `${title.value} | ARENA Sports Operations`
})
watch([query, sportFilter, statusFilter, countryFilter, sort], () => (athletePage.value = 1))
watch(athletePages, (count) => {
  if (athletePage.value > count) athletePage.value = count
})
watch(authenticated, value => { if (!value) form.value = null })
watch(overlay, async (value) => {
  if (value) {
    await nextTick()
    dialog.value?.showModal()
    if (value === 'search') searchInput.value?.focus()
  }
})
onMounted(() => {
  refresh()
  restoreSession()
  window.addEventListener('hashchange', handleHash)
  window.addEventListener('keydown', handleKeys)
})
onUnmounted(() => {
  window.removeEventListener('hashchange', handleHash)
  window.removeEventListener('keydown', handleKeys)
  clearTimeout(toastTimer)
})
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content" @click.prevent="focusMain">Skip to main content</a>
    <button
      v-if="mobileNav"
      class="sidebar-scrim"
      aria-label="Close navigation"
      @click="mobileNav = false"
    ></button>
    <aside class="sidebar" :class="{ 'is-open': mobileNav }" aria-label="Main navigation">
      <a href="#overview" class="brand" @click="navigate('overview')"
        ><svg viewBox="0 0 36 36" aria-hidden="true">
          <path d="M3 29 16 3h7l11 26H24l-5-15-7 15z" fill="currentColor" />
          <path d="m14 24 16-7 3 7z" fill="#9bc647" /></svg
        ><span>ARENA<small>SPORTS OPERATIONS</small></span></a
      >
      <div class="workspace-card">
        <span class="workspace-mark"><AppIcon name="trophy" :size="22" /></span>
        <div><strong>International Games</strong><small>Riyadh 2026 workspace</small></div>
      </div>
      <span class="nav-label">WORKSPACE</span>
      <nav>
        <a
          v-for="item in navigation"
          :key="item.id"
          :href="`#${item.id}`"
          :class="{ active: page === item.id }"
          :aria-current="page === item.id ? 'page' : undefined"
          @click="navigate(item.id)"
          ><AppIcon :name="item.icon" /><span>{{ item.label }}</span
          ><span v-if="item.id === 'competitions' && liveEvents.length" class="nav-count">{{
            liveEvents.length
          }}</span></a
        >
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-callout">
          <span class="callout-icon"><AppIcon name="spark" :size="20" /></span>
          <h3>Built for the big moments.</h3>
          <p>Every athlete. Every result.<br />One connected platform.</p>
          <button @click="overlay = 'help'">
            Explore your workspace<AppIcon name="chevron" :size="16" />
          </button>
        </div>
        <button class="help-button" @click="overlay = 'help'">
          <AppIcon name="help" :size="19" />Help & getting started
        </button>
        <div class="sidebar-footer">
          <span class="connection-dot"></span
          >{{
            error
              ? 'Connection interrupted'
              : loading
                ? 'Connecting to workspace'
                : meta.mode === 'demo'
                  ? 'Demo workspace'
                  : 'MongoDB connected'
          }}<span>v1.0</span>
        </div>
      </div>
    </aside>

    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">
          <button
            class="icon-button mobile-menu"
            aria-label="Open navigation"
            :aria-expanded="mobileNav"
            @click="mobileNav = !mobileNav"
          >
            <AppIcon name="menu" /></button
          ><span>Workspace</span><span class="breadcrumb-divider">/</span
          ><strong>{{ title }}</strong>
        </div>
        <div class="topbar-actions">
          <button class="global-search" @click="overlay = 'search'">
            <AppIcon name="search" :size="17" /><span>Search anything…</span><kbd>Ctrl K</kbd>
          </button>
          <div class="topbar-divider"></div>
          <div class="menu-anchor">
            <button
              class="icon-button notification-button"
              aria-label="View workspace activity"
              :aria-expanded="menu === 'notifications'"
              @click="menu = menu === 'notifications' ? null : 'notifications'"
            >
              <AppIcon name="bell" /><i v-if="liveEvents.length"></i>
            </button>
            <div v-if="menu === 'notifications'" class="popover activity-popover">
              <h3>Workspace activity</h3>
              <p>{{ liveEvents.length }} competitions are live.</p>
              <button v-for="event in liveEvents" :key="event._id" @click="openCompetition(event)">
                <span class="activity-icon"><AppIcon :name="sportIcon(event.sport)" /></span
                ><span
                  ><strong>{{ event.name }}</strong
                  ><small>Live · {{ event.participants.length }} athletes entered</small></span
                >
              </button>
              <p v-if="!liveEvents.length">No live competitions right now.</p>
              <button class="text-button" @click="navigate('results')">
                Review
                {{ results.filter((result) => result.status === 'Provisional').length }} provisional
                results
              </button>
            </div>
          </div>
          <div class="menu-anchor">
            <button
              class="profile-button"
              :aria-expanded="menu === 'profile'"
              @click="menu = menu === 'profile' ? null : 'profile'"
            >
              <span class="profile-avatar">{{ authenticated ? 'RB' : 'V' }}</span
              ><span><strong>{{ authenticated ? 'Ryan Bramantyo' : 'Visitor' }}</strong><small>{{ authenticated ? 'Administrator' : 'Public view' }}</small></span
              ><AppIcon name="down" :size="14" />
            </button>
            <div v-if="menu === 'profile'" class="popover profile-popover">
              <strong>{{ authenticated ? 'Administrator workspace' : 'Welcome to ARENA' }}</strong>
              <p>{{ authenticated ? `Signed in as ${adminUsername}` : 'Explore athletes, competitions and results.' }}</p>
              <button v-if="!authenticated" class="button primary" @click="beginLogin">Administrator sign-in</button>
              <button v-else class="button secondary" @click="signOut">Sign out</button>
              <span class="badge active">{{
                meta.mode === 'demo' ? 'Persistent demo storage' : 'MongoDB storage'
              }}</span
              ><a href="/about" target="_blank" rel="noopener"
                >About this platform<AppIcon name="chevron" :size="16"
              /></a>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabindex="-1">
        <div class="page-heading">
          <div>
            <div class="eyebrow heading-eyebrow">THE BIG PICTURE</div>
            <h1>{{ page === 'overview' ? 'Your games. Under control.' : title }}</h1>
            <p>
              {{
                {
                  overview: 'A clear view of every athlete, competition and defining moment.',
                  athletes: 'The people behind every extraordinary performance.',
                  competitions: 'From the first entry to the final podium.',
                  results: 'Every performance. Precisely recorded.',
                  schedule: 'A clear plan for every moment of the games.',
                  reports: 'Turn your competition data into a bigger picture.',
                }[page]
              }}
            </p>
          </div>
          <div class="heading-actions">
            <span v-if="page === 'overview'" class="date-label"
              ><AppIcon name="calendar" :size="17" />{{ currentDate }}</span
            ><button
              v-if="authenticated && (page === 'overview' || page === 'competitions')"
              class="button primary"
              :disabled="loading || !!error"
              @click="openForm({ kind: 'events' })"
            >
              <AppIcon name="plus" :size="18" />Create competition</button
            ><button
              v-if="authenticated && page === 'athletes'"
              class="button primary"
              :disabled="loading || !!error"
              @click="openForm({ kind: 'athletes' })"
            >
              <AppIcon name="plus" :size="18" />Register athlete</button
            ><button
              v-if="authenticated && page === 'results'"
              class="button primary"
              :disabled="loading || !!error"
              @click="openForm({ kind: 'results' })"
            >
              <AppIcon name="plus" :size="18" />Record result</button
            ><button
              v-if="page === 'reports'"
              class="button secondary"
              @click="refresh"
              :disabled="loading"
            >
              <AppIcon name="refresh" :size="17" />Refresh data
            </button>
          </div>
        </div>
        <div v-if="error" class="error-banner" role="alert">
          <AppIcon name="help" />{{ error
          }}<button class="button secondary" @click="refresh">Retry connection</button>
        </div>
        <div
          v-if="loading && !athletes.length && !events.length && !error"
          class="loading-state"
          role="status"
        >
          <span class="loader"></span>
          <h2>Preparing your workspace</h2>
          <p>Bringing the games together…</p>
        </div>
        <template v-else-if="!error || athletes.length || events.length">
          <template v-if="page === 'overview'">
            <section class="hero-banner" aria-label="International Games workspace">
              <div class="hero-content">
                <span class="hero-kicker"><span></span>THE STAGE IS SET. YOU’RE IN CONTROL.</span>
                <h2>Behind every<br />great <em>sporting moment.</em></h2>
                <p>
                  Bring your people, competitions and results together.<br
                    class="desktop-break"
                  />Make every moment count.
                </p>
                <button class="button lime" @click="navigate('competitions')">
                  Explore competitions<AppIcon name="chevron" :size="17" />
                </button>
              </div>
              <div class="hero-art">
                <div class="hero-track"></div>
                <div class="hero-caption">
                  <span class="hero-caption-mark"><AppIcon name="trophy" :size="24" /></span>
                  <div>
                    <strong>RIYADH 2026</strong><span>INTERNATIONAL GAMES · DEMO EDITION</span>
                  </div>
                </div>
                <span class="hero-coordinate">24.7136° N &nbsp; 46.6753° E</span>
              </div>
            </section>
            <section class="stats-grid" aria-label="Workspace statistics">
              <button
                v-for="stat in stats"
                :key="stat.label"
                class="stat-card"
                @click="navigate(stat.page)"
              >
                <div class="stat-top">
                  <span>{{ stat.label }}</span
                  ><span class="stat-icon" :class="stat.color"
                    ><AppIcon :name="stat.icon" :size="21"
                  /></span>
                </div>
                <strong>{{ String(stat.value).padStart(2, '0') }}</strong>
                <div class="stat-note">
                  <span v-if="stat.color === 'green'" class="mini-check"
                    ><AppIcon name="check" :size="12" /></span
                  ><span v-if="stat.color === 'purple'" class="live-dot"></span>{{ stat.note }}
                </div>
              </button>
            </section>
            <div class="overview-grid">
              <section class="competitions-section">
                <div class="section-heading">
                  <div>
                    <h2>
                      In the spotlight<span class="count-pill">{{ filteredEvents.length }}</span>
                    </h2>
                    <p>Where the action is happening.</p>
                  </div>
                  <button class="text-button" @click="navigate('competitions')">
                    View all<AppIcon name="chevron" :size="15" />
                  </button>
                </div>
                <div class="section-toolbar">
                  <div class="tabs">
                    <button
                      v-for="tab in ['All competitions', 'Live', 'Upcoming']"
                      :key="tab"
                      :class="{ selected: eventTab === tab }"
                      @click="eventTab = tab"
                    >
                      {{ tab }}<span v-if="tab === 'Live'" class="tab-live-dot"></span>
                    </button>
                  </div>
                  <label class="compact-select"
                    ><span class="visually-hidden">Filter spotlight by sport</span
                    ><select v-model="sportFilter">
                      <option value="">All sports</option>
                      <option v-for="sport in meta.sports" :key="sport">{{ sport }}</option>
                    </select></label
                  >
                </div>
                <div class="competition-grid overview-cards">
                  <CompetitionCard
                    v-for="event in filteredEvents.slice(0, 2)"
                    :key="event._id"
                    :event="event"
                    @open="openCompetition"
                  />
                </div>
                <div v-if="!filteredEvents.length" class="empty-state panel">
                  <AppIcon name="trophy" :size="30" />
                  <h3>No competitions to show</h3>
                  <button class="text-button" @click="clearFilters">Reset filters</button>
                </div>
              </section>
              <section class="schedule-panel panel">
                <div class="section-heading">
                  <div>
                    <h2>On the schedule</h2>
                    <p>All times in Arabia Standard Time</p>
                  </div>
                  <span class="subtle-icon"><AppIcon name="calendar" /></span>
                </div>
                <div class="schedule-tabs">
                  <button
                    v-for="day in ['Today', 'Tomorrow']"
                    :key="day"
                    :class="{ selected: scheduleDay === day }"
                    @click="scheduleDay = day"
                  >
                    {{ day }}<span>{{ formatDate(day === 'Today' ? today : localDay(1)) }}</span>
                  </button>
                </div>
                <div class="schedule-list">
                  <button
                    v-for="event in dayEvents.slice(0, 3)"
                    :key="event._id"
                    class="schedule-item"
                    @click="openCompetition(event)"
                  >
                    <div class="schedule-time">{{ event.time }}<small>AST</small></div>
                    <span class="schedule-sport" :class="event.sport.toLowerCase()"
                      ><AppIcon :name="sportIcon(event.sport)" :size="20"
                    /></span>
                    <div class="schedule-description">
                      <strong>{{ event.discipline }}</strong
                      ><small>{{ event.sport }} · {{ event.location }}</small
                      ><span v-if="event.status === 'Live'" class="schedule-live">Live now</span
                      ><span v-else class="schedule-status">{{ event.status }}</span>
                    </div>
                  </button>
                  <div v-if="!dayEvents.length" class="empty-state compact">
                    <AppIcon name="calendar" :size="28" />
                    <p>No competitions on this day.</p>
                  </div>
                </div>
                <button class="schedule-footer" @click="navigate('schedule')">
                  View full schedule<AppIcon name="chevron" :size="16" />
                </button>
              </section>
            </div>
            <div class="overview-grid bottom-grid">
              <section class="panel results-panel">
                <div class="section-heading">
                  <div>
                    <h2>
                      Latest results<span class="badge published"
                        ><span class="connection-dot"></span>Published</span
                      >
                    </h2>
                    <p>The performances making their mark.</p>
                  </div>
                  <button class="text-button" @click="navigate('results')">
                    All results<AppIcon name="chevron" :size="15" />
                  </button>
                </div>
                <ResultsTable
                  :results="recentResults"
                  :all-results="results"
                  :athletes="athletes"
                  :events="events"
                  :countries="meta.countries"
                />
              </section>
              <section class="panel nations-panel">
                <div class="section-heading">
                  <div>
                    <h2>A world of talent</h2>
                    <p>{{ nations.length }} nations. One shared passion.</p>
                  </div>
                  <AppIcon name="globe" :size="23" />
                </div>
                <div
                  class="nation-row"
                  v-for="nation in countryStats.slice(0, 4)"
                  :key="nation.name"
                >
                  <img
                    :src="`/images/flags/${nation.code?.toLowerCase()}.png`"
                    alt=""
                    class="flag"
                  /><strong>{{ nation.name }}</strong
                  ><span>{{ nation.count }} <small>athletes</small></span>
                </div>
                <button class="schedule-footer" @click="navigate('reports')">
                  Explore participation<AppIcon name="chevron" :size="16" />
                </button>
              </section>
            </div>
          </template>

          <template v-else-if="page === 'athletes'">
            <div class="summary-strip">
              <span
                ><AppIcon name="users" /> <strong>{{ athletes.length }}</strong> registered
                athletes</span
              ><span
                ><i class="live-dot"></i><strong>{{ activeAthletes.length }}</strong> active</span
              ><span
                ><AppIcon name="globe" /><strong>{{ nations.length }}</strong> nations
                represented</span
              >
            </div>
            <section class="panel management-panel">
              <div class="management-toolbar">
                <label class="search-field"
                  ><AppIcon name="search" :size="18" /><input
                    v-model="query"
                    type="search"
                    placeholder="Search athletes…"
                    aria-label="Search athletes"
                /></label>
                <div class="filter-group">
                  <select v-model="sportFilter" aria-label="Filter athletes by sport">
                    <option value="">All sports</option>
                    <option v-for="sport in meta.sports" :key="sport">{{ sport }}</option></select
                  ><select v-model="countryFilter" aria-label="Filter athletes by country">
                    <option value="">All countries</option>
                    <option v-for="nation in nations.sort()" :key="nation">
                      {{ nation }}
                    </option></select
                  ><select v-model="statusFilter" aria-label="Filter athletes by status">
                    <option value="">All statuses</option>
                    <option>Active</option>
                    <option>Inactive</option></select
                  ><button
                    class="button secondary"
                    @click="exportAthletes"
                    :disabled="!filteredAthletes.length"
                  >
                    <AppIcon name="download" :size="17" />Export
                  </button>
                </div>
              </div>
              <div class="table-caption">
                <span
                  ><strong>Athlete directory</strong
                  ><span class="count-pill">{{ filteredAthletes.length }}</span></span
                ><label
                  >Sort by
                  <select v-model="sort" aria-label="Sort athletes">
                    <option value="name">Name A–Z</option>
                    <option value="recent">Newest first</option>
                    <option value="age">Age</option>
                  </select></label
                >
              </div>
              <div class="table-scroll">
                <table class="data-table athlete-table">
                  <thead>
                    <tr>
                      <th>Athlete</th>
                      <th>Country</th>
                      <th>Sport</th>
                      <th>Age</th>
                      <th>Status</th>
                      <th><span class="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="athlete in pagedAthletes" :key="athlete._id">
                      <td>
                        <div class="person">
                          <span class="avatar" :class="`tone-${athlete.name.length % 4}`">{{
                            initials(athlete.name)
                          }}</span>
                          <div>
                            <strong>{{ athlete.name }}</strong
                            ><small>ATH-{{ athlete._id.slice(-4).toUpperCase() }}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="country-cell"
                          ><img
                            :src="`/images/flags/${country(athlete.country)?.code.toLowerCase()}.png`"
                            alt=""
                            class="flag"
                          />{{ athlete.country }}</span
                        >
                      </td>
                      <td>
                        <span class="sport-cell"
                          ><AppIcon :name="sportIcon(athlete.sport)" :size="17" />{{
                            athlete.sport
                          }}</span
                        >
                      </td>
                      <td>{{ athlete.age }}</td>
                      <td>
                        <span class="badge" :class="athlete.status.toLowerCase()"
                          ><i></i>{{ athlete.status }}</span
                        >
                      </td>
                      <td>
                        <button
                          v-if="authenticated"
                          class="icon-button small"
                          :aria-label="`Edit ${athlete.name}`"
                          @click="openForm({ kind: 'athletes', record: athlete })"
                        >
                          <AppIcon name="edit" :size="17" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="!filteredAthletes.length" class="empty-state">
                  <AppIcon name="users" :size="35" />
                  <h3>No athletes found</h3>
                  <p>Try another search or register your first athlete.</p>
                  <button class="text-button" @click="clearFilters">Clear filters</button>
                </div>
              </div>
              <div class="pagination-bar">
                <span
                  >Showing {{ filteredAthletes.length ? (athletePage - 1) * pageSize + 1 : 0 }}–{{
                    Math.min(athletePage * pageSize, filteredAthletes.length)
                  }}
                  of {{ filteredAthletes.length }} athletes</span
                >
                <div>
                  <button
                    class="icon-button small"
                    aria-label="Previous page"
                    :disabled="athletePage === 1"
                    @click="athletePage--"
                  >
                    <AppIcon name="chevron" class="flip" :size="16" /></button
                  ><button
                    v-for="n in athletePages"
                    :key="n"
                    class="page-number"
                    :class="{ selected: n === athletePage }"
                    :aria-label="`Page ${n}`"
                    :aria-current="n === athletePage ? 'page' : undefined"
                    @click="athletePage = n"
                  >
                    {{ n }}</button
                  ><button
                    class="icon-button small"
                    aria-label="Next page"
                    :disabled="athletePage >= athletePages"
                    @click="athletePage++"
                  >
                    <AppIcon name="chevron" :size="16" />
                  </button>
                </div>
              </div>
            </section>
          </template>

          <template v-else-if="page === 'competitions'">
            <div class="management-toolbar standalone">
              <div class="tabs">
                <button
                  v-for="tab in ['All competitions', 'Live', 'Upcoming', 'Completed']"
                  :key="tab"
                  :class="{ selected: eventTab === tab }"
                  @click="eventTab = tab"
                >
                  {{ tab }}<span v-if="tab === 'Live'" class="tab-live-dot"></span>
                </button>
              </div>
              <div class="filter-group">
                <label class="search-field"
                  ><AppIcon name="search" :size="17" /><input
                    v-model="query"
                    type="search"
                    placeholder="Search competitions…"
                    aria-label="Search competitions" /></label
                ><select v-model="sportFilter" aria-label="Filter competitions by sport">
                  <option value="">All sports</option>
                  <option v-for="sport in meta.sports" :key="sport">{{ sport }}</option>
                </select>
              </div>
            </div>
            <div class="competition-grid all-cards">
              <CompetitionCard
                v-for="event in filteredEvents"
                :key="event._id"
                :event="event"
                @open="openCompetition"
              />
            </div>
            <div v-if="!filteredEvents.length" class="empty-state panel">
              <AppIcon name="trophy" :size="35" />
              <h3>No competitions found</h3>
              <p>Create a competition or adjust your filters.</p>
              <button class="text-button" @click="clearFilters">Clear filters</button>
            </div>
          </template>

          <template v-else-if="page === 'results'">
            <div class="summary-strip">
              <span
                ><AppIcon name="medal" /><strong>{{ published.length }}</strong> published
                results</span
              ><span
                ><AppIcon name="clock" /><strong>{{ results.length - published.length }}</strong>
                provisional results</span
              ><span>Places are calculated per competition and publication status.</span>
            </div>
            <section class="panel management-panel">
              <div class="management-toolbar">
                <label class="search-field"
                  ><AppIcon name="search" :size="18" /><input
                    v-model="query"
                    type="search"
                    placeholder="Search results…"
                    aria-label="Search results"
                /></label>
                <div class="filter-group">
                  <select v-model="resultEvent" aria-label="Filter results by competition">
                    <option value="">All competitions</option>
                    <option v-for="event in events" :key="event._id" :value="event._id">
                      {{ event.name }}
                    </option></select
                  ><select v-model="statusFilter" aria-label="Filter results by status">
                    <option value="">All statuses</option>
                    <option>Published</option>
                    <option>Provisional</option></select
                  ><button
                    class="button secondary"
                    :disabled="!filteredResults.length"
                    @click="exportResults"
                  >
                    <AppIcon name="download" :size="17" />Export
                  </button>
                </div>
              </div>
              <ResultsTable
                :results="filteredResults"
                :all-results="results"
                :athletes="athletes"
                :events="events"
                :countries="meta.countries"
                :editable="authenticated"
                @edit="openForm({ kind: 'results', record: $event })"
              />
              <div class="pagination-bar">
                <span>{{ filteredResults.length }} results · Tied performances share a place</span
                ><button class="text-button" @click="clearFilters">Reset filters</button>
              </div>
            </section>
          </template>

          <template v-else-if="page === 'schedule'">
            <section class="panel schedule-page">
              <div class="management-toolbar">
                <div class="filter-group">
                  <label class="date-field"
                    >Competition date<input
                      v-model="scheduleDate"
                      type="date"
                      aria-label="Competition date" /></label
                  ><button class="button secondary" @click="scheduleDate = today">Today</button
                  ><button class="text-button" @click="scheduleDate = ''">All dates</button>
                </div>
                <select v-model="sportFilter" aria-label="Filter schedule by sport">
                  <option value="">All sports</option>
                  <option v-for="sport in meta.sports" :key="sport">{{ sport }}</option>
                </select>
              </div>
              <div class="schedule-page-title">
                <h2>
                  {{
                    scheduleDate
                      ? formatDate(scheduleDate, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'The complete games schedule'
                  }}
                </h2>
                <span>{{ scheduleEvents.length }} competitions · All times AST (UTC+3)</span>
              </div>
              <button
                v-for="event in scheduleEvents"
                :key="event._id"
                class="agenda-row"
                @click="openCompetition(event)"
              >
                <div class="agenda-time">
                  <strong>{{ event.time }}</strong
                  ><span>{{ formatDate(event.date) }}</span>
                </div>
                <span class="agenda-icon"
                  ><AppIcon :name="sportIcon(event.sport)" :size="28"
                /></span>
                <div class="agenda-name">
                  <span class="eyebrow">{{ event.sport }}</span>
                  <h3>{{ event.name }}</h3>
                  <p>{{ event.discipline }}</p>
                </div>
                <span class="agenda-venue"
                  ><AppIcon name="pin" :size="16" />{{ event.location }}</span
                ><span class="badge" :class="event.status.toLowerCase()"
                  ><i v-if="event.status === 'Live'"></i>{{ event.status }}</span
                ><AppIcon name="chevron" :size="18" />
              </button>
              <div v-if="!scheduleEvents.length" class="empty-state">
                <AppIcon name="calendar" :size="35" />
                <h3>A little breathing room</h3>
                <p>No competitions match this date and sport.</p>
                <button
                  class="text-button"
                  @click="showAllSchedule"
                >
                  View all dates
                </button>
              </div>
            </section>
          </template>

          <template v-else-if="page === 'reports'">
            <section class="stats-grid report-stats">
              <div v-for="stat in stats" :key="stat.label" class="stat-card">
                <div class="stat-top">
                  <span>{{ stat.label }}</span
                  ><span class="stat-icon" :class="stat.color"><AppIcon :name="stat.icon" /></span>
                </div>
                <strong>{{ stat.value }}</strong>
                <div class="stat-note">{{ stat.note }}</div>
              </div>
            </section>
            <div class="reports-grid">
              <section class="panel">
                <div class="section-heading">
                  <div>
                    <h2>Participation by sport</h2>
                    <p>Athlete distribution across your programme.</p>
                  </div>
                  <AppIcon name="chart" />
                </div>
                <div class="sport-breakdown">
                  <div v-for="(sport, index) in sportStats" :key="sport.name" class="sport-bar-row">
                    <div>
                      <span
                        ><AppIcon :name="sportIcon(sport.name)" :size="18" />{{ sport.name }}</span
                      ><strong>{{ sport.count }} <small>athletes</small></strong>
                    </div>
                    <div class="bar-track">
                      <span
                        :style="{
                          width: `${athletes.length ? (sport.count / athletes.length) * 100 : 0}%`,
                          background: [
                            '#2d6555',
                            '#8e9cdb',
                            '#c0d67d',
                            '#e7ab75',
                            '#7db5be',
                            '#d59fb3',
                          ][index],
                        }"
                      ></span>
                    </div>
                    <small
                      >{{ sport.events }} competitions ·
                      {{ athletes.length ? Math.round((sport.count / athletes.length) * 100) : 0 }}%
                      of athletes</small
                    >
                  </div>
                </div>
              </section>
              <section class="panel">
                <div class="section-heading">
                  <div>
                    <h2>Nation participation</h2>
                    <p>Representation and published first places.</p>
                  </div>
                  <AppIcon name="globe" />
                </div>
                <div class="table-scroll">
                  <table class="data-table nation-table">
                    <thead>
                      <tr>
                        <th>Nation</th>
                        <th>Athletes</th>
                        <th>First places</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="nation in countryStats" :key="nation.name">
                        <td>
                          <span class="country-cell"
                            ><img
                              :src="`/images/flags/${nation.code?.toLowerCase()}.png`"
                              class="flag"
                              alt=""
                            />{{ nation.name }}</span
                          >
                        </td>
                        <td>{{ nation.count }}</td>
                        <td>
                          <span class="gold-count">{{ nation.gold }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
            <section class="report-downloads">
              <div>
                <span class="eyebrow">TAKE THE DATA FURTHER</span>
                <h2>Your next briefing, ready.</h2>
                <p>Download UTF-8 CSV reports to use in Excel or your presentation.</p>
              </div>
              <div>
                <button class="button secondary" @click="exportAthletes">
                  <AppIcon name="download" :size="17" />Athletes</button
                ><button class="button secondary" @click="exportCompetitions">
                  <AppIcon name="download" :size="17" />Competitions</button
                ><button class="button primary" @click="exportResults">
                  <AppIcon name="download" :size="17" />Results
                </button>
              </div>
            </section>
          </template>
        </template>
        <footer class="main-footer">
          <span><strong>ARENA</strong> The technology behind the moment.</span
          ><span
            >Independent portfolio project<span class="footer-dot">·</span>Fictional demo data</span
          >
        </footer>
      </main>
    </div>
    <Transition name="toast"
      ><div v-if="toast" class="toast-message" role="status">
        <span><AppIcon name="check" :size="18" /></span>{{ toast
        }}<button class="icon-button" aria-label="Dismiss notification" @click="toast = ''">
          <AppIcon name="close" :size="16" />
        </button></div
    ></Transition>
    <AdminLogin v-if="showLogin" @close="showLogin = false" @signed-in="signedIn" />
    <RecordForm
      v-if="form"
      :state="form"
      :athletes="athletes"
      :events="events"
      :meta="meta"
      :persist="persist"
      @close="form = null"
      @saved="saved"
      @delete="requestDelete"
    />
    <dialog
      v-if="overlay"
      ref="dialog"
      class="modal-dialog"
      :class="{ 'wide-dialog': overlay === 'competition', 'search-dialog': overlay === 'search' }"
      :aria-labelledby="`${overlay}-title`"
      @cancel.prevent="closeOverlay"
      @click="$event.target === dialog && closeOverlay()"
    >
      <template v-if="overlay === 'competition' && selectedEvent"
        ><div
          class="detail-cover"
          :style="{ backgroundImage: `url(${sportImage(selectedEvent.sport)})` }"
        >
          <span class="photo-label"
            ><AppIcon :name="sportIcon(selectedEvent.sport)" :size="17" />{{
              selectedEvent.sport
            }}</span
          ><button class="icon-button" aria-label="Close competition details" @click="closeOverlay">
            <AppIcon name="close" />
          </button>
          <div>
            <span class="badge" :class="selectedEvent.status.toLowerCase()">{{
              selectedEvent.status
            }}</span>
            <h2 id="competition-title">{{ selectedEvent.name }}</h2>
            <p>{{ selectedEvent.discipline }}</p>
          </div>
        </div>
        <div class="modal-body">
          <div class="detail-meta">
            <span
              ><AppIcon name="calendar" />{{ formatDate(selectedEvent.date) }}
              {{ selectedEvent.date.slice(0, 4) }} · {{ selectedEvent.time }} AST</span
            ><span><AppIcon name="pin" />{{ selectedEvent.location }}</span
            ><span
              ><AppIcon name="users" />{{ selectedEvent.participants.length }} /
              {{ selectedEvent.capacity }} entries</span
            >
          </div>
          <div class="detail-section-heading">
            <h3>Start list</h3>
            <button
              v-if="authenticated"
              class="text-button"
              @click="openForm({ kind: 'events', record: selectedEvent })"
            >
              <AppIcon name="edit" :size="15" />Manage competition & entries
            </button>
          </div>
          <div class="roster-grid">
            <div v-for="id in selectedEvent.participants" :key="id" class="person">
              <span class="avatar">{{ initials(findAthlete(id)?.name || '?') }}</span>
              <div>
                <strong>{{ findAthlete(id)?.name }}</strong
                ><small>{{ findAthlete(id)?.country }}</small>
              </div>
            </div>
            <p v-if="!selectedEvent.participants.length" class="muted">
              No athletes entered yet.
            </p>
          </div>
          <div class="detail-section-heading">
            <h3>Competition results</h3>
            <span class="muted"
              >{{ selectedEvent.ranking === 'asc' ? 'Lowest' : 'Highest' }}
              {{ selectedEvent.unit }} wins</span
            >
          </div>
          <ResultsTable
            :results="selectedResults"
            :all-results="results"
            :athletes="athletes"
            :events="events"
            :countries="meta.countries"
          />
        </div>
        <div v-if="authenticated" class="modal-footer">
          <button
            class="button secondary"
            @click="openForm({ kind: 'events', record: selectedEvent })"
          >
            <AppIcon name="edit" :size="17" />Edit competition</button
          ><span class="spacer"></span
          ><button
            class="button primary"
            :disabled="selectedEvent.status === 'Scheduled'"
            @click="recordForSelectedCompetition"
          >
            <AppIcon name="plus" :size="17" />Record a result
          </button>
        </div></template
      >
      <template v-else-if="overlay === 'help'"
        ><div class="modal-header">
          <div>
            <span class="eyebrow">WELCOME TO ARENA</span>
            <h2 id="help-title">Your games start here.</h2>
            <p>A connected workspace for competition operations.</p>
          </div>
          <button class="icon-button" aria-label="Close help" @click="closeOverlay">
            <AppIcon name="close" />
          </button>
        </div>
        <div class="modal-body help-content">
          <div>
            <span class="help-step"><AppIcon name="users" /></span>
            <h3>Build your athlete directory</h3>
            <p>
              Register athletes with a country and sport. Search, filter and update their details in
              the Athletes view.
            </p>
          </div>
          <div>
            <span class="help-step"><AppIcon name="trophy" /></span>
            <h3>Set the stage</h3>
            <p>
              Create a competition, choose the discipline and scoring rules, then select active
              athletes for its start list. Move its status to Live when it begins.
            </p>
          </div>
          <div>
            <span class="help-step"><AppIcon name="medal" /></span>
            <h3>Make every performance count</h3>
            <p>
              Record results for entered athletes. Save them as provisional or published. Rankings
              update automatically; export the data for your next briefing.
            </p>
          </div>
          <div class="info-box">
            <AppIcon name="help" />
            <p>
              Demo changes persist on this server. All sample athletes and competitions are
              fictional. This portfolio project is independently built and is not affiliated with
              FIFA.
            </p>
          </div>
          <a class="text-button" href="/about" target="_blank" rel="noopener"
            >Explore the technology behind ARENA<AppIcon name="chevron" :size="16"
          /></a>
        </div>
        <div class="modal-footer">
          <span class="spacer"></span
          ><button
            class="button primary"
            @click="exploreAthletes"
          >
            Explore athletes<AppIcon name="chevron" :size="17" />
          </button></div
      ></template>
      <template v-else-if="overlay === 'search'"
        ><div class="modal-header search-header">
          <AppIcon name="search" :size="24" /><label
            class="visually-hidden"
            for="global-query"
            id="search-title"
            >Search the workspace</label
          ><input
            id="global-query"
            ref="searchInput"
            v-model="globalQuery"
            placeholder="Find an athlete or competition…"
          /><button class="icon-button" aria-label="Close search" @click="closeOverlay">
            <AppIcon name="close" />
          </button>
        </div>
        <div class="modal-body search-results">
          <span class="eyebrow">ATHLETES</span
          ><button
            v-for="athlete in searchAthletes"
            :key="athlete._id"
            @click="openSearchAthlete(athlete)"
          >
            <span class="avatar">{{ initials(athlete.name) }}</span
            ><span
              ><strong>{{ athlete.name }}</strong
              ><small>{{ athlete.sport }} · {{ athlete.country }}</small></span
            ><AppIcon name="chevron" :size="17" />
          </button>
          <p v-if="!searchAthletes.length" class="muted">No matching athletes.</p>
          <span class="eyebrow">COMPETITIONS</span
          ><button v-for="event in searchEvents" :key="event._id" @click="openCompetition(event)">
            <span class="avatar"><AppIcon :name="sportIcon(event.sport)" /></span
            ><span
              ><strong>{{ event.name }}</strong
              ><small>{{ event.sport }} · {{ event.status }}</small></span
            ><AppIcon name="chevron" :size="17" />
          </button>
          <p v-if="!searchEvents.length" class="muted">No matching competitions.</p>
        </div></template
      >
      <template v-else-if="overlay === 'delete' && deletion"
        ><div class="modal-header">
          <div>
            <span class="eyebrow">REMOVE RECORD</span>
            <h2 id="delete-title">Delete this {{ deletion.label }}?</h2>
            <p>
              This record will be permanently removed. Linked entries and results must be removed
              first.
            </p>
          </div>
          <button
            class="icon-button"
            aria-label="Close delete confirmation"
            :disabled="deleting"
            @click="closeOverlay"
          >
            <AppIcon name="close" />
          </button>
        </div>
        <div v-if="deleteError" class="modal-body">
          <p class="error-banner" role="alert">{{ deleteError }}</p>
        </div>
        <div class="modal-footer">
          <span class="spacer"></span
          ><button class="button secondary" :disabled="deleting" @click="closeOverlay">
            Keep record</button
          ><button class="button danger" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? 'Deleting…' : 'Delete record' }}
          </button>
        </div></template
      >
    </dialog>
  </div>
</template>
