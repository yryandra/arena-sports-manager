<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const paths: Record<string, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  trophy:
    'M8 3h8v7a4 4 0 0 1-8 0z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 14v6 M7 21h10',
  chart: 'M4 3v17h17 M8 15v-4 M13 15V7 M18 15v-8',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2 M7 3v4 M17 3v4 M3 11h18 M7 15h2 M13 15h2',
  file: 'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  plus: 'M12 5v14 M5 12h14',
  close: 'm6 6 12 12 M6 18 18 6',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  globe:
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2c6 6 6 14 0 20 M12 2c-6 6-6 14 0 20',
  check: 'm5 12 4 4L19 6',
  help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5 M12 17h.01',
  settings:
    'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  logout: 'M9 3H3v18h6 M9 12h12 m-4-4 4 4-4 4',
  edit: 'm16 3 5 5-12 12-6 1 1-6z M13 6l5 5',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  refresh: 'M20 7a9 9 0 1 0 1 9 M20 2v6h-6',
  run: 'M15 4h.01 M17 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M12 8l-3 5 5 2-3 6 M12 8l4 5h4 M9 13l-4 5H2 M8 7l-4 3',
  swim: 'M2 20q2-3 5 0t5 0 5 0 5 0 M2 16q2-3 5 0t5 0 5 0 5 0 M8 13l4-5-5-3 M12 8l4 5 M21 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  ball: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 m-10-5 5 4-2 6H9l-2-6z M12 7V2 M7 11l-5-2 M9 17l-3 4 M15 17l3 4 M17 11l5-2',
  basketball:
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2v20 M5 5c10 3 4 11 14 14 M19 5C9 8 15 16 5 19',
  bike: 'M10 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M6 17l4-9 8 9-4-13h3 M8 8h5',
  tennis: 'M18 3c4 4 2 8-1 11s-7 5-10 2-1-7 2-10 6-6 9-3 M7 16l-5 6 M8 8l8 8 M12 4l8 8 M6 12l8-8',
  medal: 'M8 3H3l6 10 M16 3h5l-6 10 M17 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  spark: 'm12 3 2 6 7 3-7 3-2 6-2-6-7-3 7-3z',
  filter: 'M3 5h18 M6 12h12 M9 19h6',
}
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.trophy" />
  </svg>
</template>
