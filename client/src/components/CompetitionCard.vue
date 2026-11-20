<script setup lang="ts">
import type { Competition } from '../types'
import AppIcon from './AppIcon.vue'
import { sportImage, sportIcon, formatDate } from '../lib/format'
defineProps<{ event: Competition }>()
defineEmits<{ open: [event: Competition] }>()
</script>
<template>
  <button class="competition-card" @click="$emit('open', event)">
    <div class="competition-photo" :style="{ backgroundImage: `url(${sportImage(event.sport)})` }">
      <span class="photo-label"
        ><AppIcon :name="sportIcon(event.sport)" :size="15" />{{ event.sport }}</span
      >
      <span class="badge" :class="event.status.toLowerCase()"
        ><i v-if="event.status === 'Live'"></i
        >{{ event.status === 'Live' ? 'Live now' : event.status }}</span
      >
    </div>
    <div class="competition-body">
      <span class="card-date"
        >{{ formatDate(event.date) }} {{ event.date.slice(0, 4) }} <span>·</span>
        {{ event.time }} AST</span
      >
      <h3>{{ event.name }}</h3>
      <p><AppIcon name="pin" :size="14" />{{ event.location }}</p>
      <div class="card-bottom">
        <span><AppIcon name="users" :size="15" />{{ event.participants.length }} athletes</span
        ><span class="round-link"><AppIcon name="chevron" :size="16" /></span>
      </div>
    </div>
  </button>
</template>
