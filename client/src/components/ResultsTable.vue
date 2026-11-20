<script setup lang="ts">
import type { Athlete, Competition, Country, Result } from '../types'
import { initials, performance, rank } from '../lib/format'
import AppIcon from './AppIcon.vue'
const props = defineProps<{
  results: Result[]
  allResults: Result[]
  athletes: Athlete[]
  events: Competition[]
  countries: Country[]
  editable?: boolean
}>()
defineEmits<{ edit: [result: Result] }>()
const athlete = (id: string) => props.athletes.find((item) => item._id === id)
const event = (id: string) => props.events.find((item) => item._id === id)
const country = (id: string) => props.countries.find((item) => item.name === athlete(id)?.country)
</script>
<template>
  <div class="table-scroll">
    <table class="data-table results-table">
      <thead>
        <tr>
          <th>Place</th>
          <th>Athlete</th>
          <th>Competition</th>
          <th>Performance</th>
          <th>Status</th>
          <th v-if="editable"><span class="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="result in results" :key="result._id">
          <td>
            <span
              class="place"
              :class="`place-${rank(result, allResults, event(result.eventId))}`"
              >{{ String(rank(result, allResults, event(result.eventId))).padStart(2, '0') }}</span
            >
          </td>
          <td>
            <div class="person">
              <span
                class="avatar"
                :class="`tone-${result.athleteId.charCodeAt(result.athleteId.length - 1) % 4}`"
                >{{ initials(athlete(result.athleteId)?.name || '?') }}</span
              >
              <div>
                <strong>{{ athlete(result.athleteId)?.name || 'Unknown athlete' }}</strong
                ><small
                  ><img
                    v-if="country(result.athleteId)"
                    :src="`/images/flags/${country(result.athleteId)?.code.toLowerCase()}.png`"
                    alt=""
                    class="flag"
                  />{{ country(result.athleteId)?.ioc }}</small
                >
              </div>
            </div>
          </td>
          <td>
            <strong class="table-event">{{ event(result.eventId)?.name }}</strong
            ><small>{{ event(result.eventId)?.discipline }}</small>
          </td>
          <td class="performance">{{ performance(result, event(result.eventId)) }}</td>
          <td>
            <span class="badge" :class="result.status.toLowerCase()">{{ result.status }}</span>
          </td>
          <td v-if="editable">
            <button
              class="icon-button small"
              :aria-label="`Edit result for ${athlete(result.athleteId)?.name}`"
              @click="$emit('edit', result)"
            >
              <AppIcon name="edit" :size="17" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="!results.length" class="empty-state">
      <AppIcon name="medal" :size="32" />
      <h3>No results here yet</h3>
      <p>Record a result or adjust your filters to get started.</p>
    </div>
  </div>
</template>
