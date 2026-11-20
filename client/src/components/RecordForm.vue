<script setup lang="ts">
import { computed, onMounted, ref, reactive } from 'vue'
import type { Athlete, Competition, FormState, Metadata, Resource, Result } from '../types'
import { errorMessage } from '../lib/api'
import { localDay, initials } from '../lib/format'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  state: FormState
  athletes: Athlete[]
  events: Competition[]
  meta: Metadata
  persist: (kind: Resource, payload: object, id?: string) => Promise<void>
}>()
const emit = defineEmits<{
  close: []
  saved: []
  delete: [kind: Resource, id: string, label: string]
}>()
const dialog = ref<HTMLDialogElement>()
const saving = ref(false)
const error = ref('')
const record = props.state.record
const athlete = record as Athlete | undefined
const event = record as Competition | undefined
const result = record as Result | undefined
const athleteForm = reactive({
  name: athlete?.name || '',
  country: athlete?.country || 'Saudi Arabia',
  sport: athlete?.sport || 'Athletics',
  age: athlete?.age || 21,
  status: athlete?.status || 'Active',
})
const eventForm = reactive({
  name: event?.name || '',
  sport: event?.sport || 'Athletics',
  discipline: event?.discipline || '',
  location: event?.location || '',
  date: event?.date || localDay(),
  time: event?.time || '18:00',
  status: event?.status || 'Scheduled',
  capacity: event?.capacity || 24,
  unit: event?.unit || 's',
  ranking: event?.ranking || 'asc',
  participants: [...(event?.participants || [])],
})
const resultForm = reactive({
  eventId: result?.eventId || props.state.eventId || '',
  athleteId: result?.athleteId || '',
  performance: result?.performance || 0,
  status: result?.status || 'Published',
})
const noun = computed(
  () => ({ athletes: 'athlete', events: 'competition', results: 'result' })[props.state.kind],
)
const title = computed(
  () =>
    `${record ? 'Edit' : props.state.kind === 'athletes' ? 'Register' : props.state.kind === 'events' ? 'Create' : 'Record'} ${noun.value}`,
)
const eligible = computed(() =>
  props.athletes.filter((item) => item.sport === eventForm.sport && item.status === 'Active'),
)
const selectedEvent = computed(() => props.events.find((item) => item._id === resultForm.eventId))
const entrants = computed(() =>
  props.athletes.filter((item) => selectedEvent.value?.participants.includes(item._id)),
)
const scoreable = computed(() => props.events.filter((item) => item.status !== 'Scheduled'))
onMounted(() => dialog.value?.showModal())
function changeSport() {
  eventForm.participants = []
}
async function submit() {
  saving.value = true
  error.value = ''
  try {
    const payload =
      props.state.kind === 'athletes'
        ? athleteForm
        : props.state.kind === 'events'
          ? eventForm
          : resultForm
    await props.persist(props.state.kind, payload, record?._id)
    emit('saved')
  } catch (failure) {
    error.value = errorMessage(failure)
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <dialog
    ref="dialog"
    class="modal-dialog record-dialog"
    aria-labelledby="record-title"
    @cancel.prevent="!saving && emit('close')"
    @click="$event.target === dialog && !saving && emit('close')"
  >
    <form @submit.prevent="submit">
      <div class="modal-header">
        <div>
          <span class="eyebrow">SPORTS OPERATIONS</span>
          <h2 id="record-title">{{ title }}</h2>
          <p>
            {{
              state.kind === 'athletes'
                ? 'Great performances start with the right details.'
                : state.kind === 'events'
                  ? 'Bring your next sporting moment to life.'
                  : 'Every performance deserves an accurate record.'
            }}
          </p>
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="Close form"
          :disabled="saving"
          @click="emit('close')"
        >
          <AppIcon name="close" />
        </button>
      </div>
      <div class="modal-body">
        <div v-if="error" class="error-banner" role="alert">{{ error }}</div>
        <div v-if="state.kind === 'athletes'" class="form-grid">
          <label class="full"
            >Full name<input
              v-model.trim="athleteForm.name"
              placeholder="e.g. Faisal Al-Qahtani"
              required
              minlength="2"
              maxlength="80"
              autofocus
          /></label>
          <label
            >Sport<select v-model="athleteForm.sport">
              <option v-for="sport in meta.sports" :key="sport">{{ sport }}</option>
            </select></label
          >
          <label
            >Country<select v-model="athleteForm.country">
              <option v-for="country in meta.countries" :key="country.code">
                {{ country.name }}
              </option>
            </select></label
          >
          <label
            >Age<input
              v-model.number="athleteForm.age"
              type="number"
              min="10"
              max="100"
              step="1"
              required
          /></label>
          <label
            >Status<select v-model="athleteForm.status">
              <option>Active</option>
              <option>Inactive</option>
            </select></label
          >
        </div>
        <div v-else-if="state.kind === 'events'" class="form-grid">
          <label class="full"
            >Competition name<input
              v-model.trim="eventForm.name"
              placeholder="e.g. Riyadh Athletics Grand Prix"
              required
              minlength="3"
              maxlength="100"
              autofocus
          /></label>
          <label
            >Sport<select v-model="eventForm.sport" @change="changeSport">
              <option v-for="sport in meta.sports" :key="sport">{{ sport }}</option>
            </select></label
          >
          <label
            >Discipline / event<input
              v-model.trim="eventForm.discipline"
              placeholder="e.g. Men’s 100m · Final"
              required
              maxlength="80"
          /></label>
          <label class="full"
            >Venue<input
              v-model.trim="eventForm.location"
              placeholder="Venue name"
              required
              maxlength="100"
          /></label>
          <label>Date<input v-model="eventForm.date" type="date" required /></label>
          <label
            >Start time (Arabia Standard Time)<input v-model="eventForm.time" type="time" required
          /></label>
          <label
            >Status<select v-model="eventForm.status">
              <option>Scheduled</option>
              <option>Live</option>
              <option>Completed</option>
            </select></label
          >
          <label
            >Athlete capacity<input
              v-model.number="eventForm.capacity"
              type="number"
              min="2"
              max="10000"
              step="1"
              required
          /></label>
          <label
            >Performance unit<select v-model="eventForm.unit">
              <option value="s">Seconds (s)</option>
              <option value="min">Minutes (min)</option>
              <option value="m">Metres (m)</option>
              <option value="pts">Points (pts)</option>
            </select></label
          >
          <label
            >Ranking order<select v-model="eventForm.ranking">
              <option value="asc">Lowest performance wins</option>
              <option value="desc">Highest performance wins</option>
            </select></label
          >
          <fieldset class="full entry-fieldset">
            <legend>
              Athlete entries
              <span>{{ eventForm.participants.length }} / {{ eventForm.capacity }}</span>
            </legend>
            <p>Choose active {{ eventForm.sport.toLowerCase() }} athletes for the start list.</p>
            <div class="entry-list">
              <label v-for="person in eligible" :key="person._id" class="entry-option"
                ><input v-model="eventForm.participants" type="checkbox" :value="person._id" /><span
                  class="avatar"
                  >{{ initials(person.name) }}</span
                ><span
                  >{{ person.name }}<small>{{ person.country }}</small></span
                ></label
              >
              <p v-if="!eligible.length" class="muted">
                Register an active athlete in this sport first.
              </p>
            </div>
          </fieldset>
        </div>
        <div v-else class="form-grid">
          <label class="full"
            >Competition<select
              v-model="resultForm.eventId"
              required
              @change="resultForm.athleteId = ''"
            >
              <option disabled value="">Choose a live or completed competition</option>
              <option
                v-for="competition in scoreable"
                :key="competition._id"
                :value="competition._id"
              >
                {{ competition.name }} — {{ competition.discipline }}
              </option>
            </select></label
          >
          <label class="full"
            >Athlete<select v-model="resultForm.athleteId" required :disabled="!resultForm.eventId">
              <option disabled value="">Choose an entered athlete</option>
              <option v-for="person in entrants" :key="person._id" :value="person._id">
                {{ person.name }} · {{ person.country }}
              </option>
            </select></label
          >
          <label
            >Performance {{ selectedEvent ? `(${selectedEvent.unit})` : ''
            }}<input
              v-model.number="resultForm.performance"
              type="number"
              min="0.001"
              max="1000000"
              step="any"
              required
          /></label>
          <label
            >Publication status<select v-model="resultForm.status">
              <option>Published</option>
              <option>Provisional</option>
            </select></label
          >
          <div class="info-box full">
            <AppIcon name="medal" />
            <p>
              Places are calculated from
              {{
                selectedEvent?.ranking === 'desc' ? 'highest to lowest' : 'lowest to highest'
              }}
              performance. Ties share a place. Provisional and published results are ranked
              separately.
            </p>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button
          v-if="record"
          type="button"
          class="button danger-text"
          :disabled="saving"
          @click="emit('delete', state.kind, record._id, noun)"
        >
          <AppIcon name="trash" :size="17" />Delete {{ noun }}</button
        ><span class="spacer"></span
        ><button type="button" class="button secondary" :disabled="saving" @click="emit('close')">
          Cancel</button
        ><button type="submit" class="button primary" :disabled="saving">
          <AppIcon v-if="!saving" name="check" :size="17" />{{
            saving ? 'Saving…' : record ? 'Save changes' : title
          }}
        </button>
      </div>
    </form>
  </dialog>
</template>
