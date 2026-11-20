<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppIcon from './AppIcon.vue'
import { login } from '../lib/auth'
import { errorMessage } from '../lib/api'
const emit = defineEmits<{ close: []; signedIn: [] }>()
const dialog = ref<HTMLDialogElement>()
const username = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
onMounted(() => dialog.value?.showModal())
async function submit() {
  busy.value = true
  error.value = ''
  try { await login(username.value, password.value); password.value = ''; emit('signedIn') }
  catch (failure) { error.value = errorMessage(failure); password.value = '' }
  finally { busy.value = false }
}
</script>
<template>
  <dialog ref="dialog" class="modal-dialog" aria-labelledby="login-title" @cancel.prevent="!busy && emit('close')" @click="$event.target === dialog && !busy && emit('close')">
    <form @submit.prevent="submit">
      <div class="modal-header"><div><span class="eyebrow">YOUR WORKSPACE</span><h2 id="login-title">Administrator sign-in</h2><p>Sign in to manage athletes, competitions and results.</p></div><button class="icon-button" type="button" aria-label="Close sign-in" :disabled="busy" @click="emit('close')"><AppIcon name="close" /></button></div>
      <div class="modal-body"><div v-if="error" class="error-banner" role="alert">{{ error }}</div><div class="form-grid"><label class="full">Username<input v-model.trim="username" autocomplete="username" required maxlength="80" autofocus /></label><label class="full">Password<input v-model="password" type="password" autocomplete="current-password" required maxlength="256" /></label></div><p class="login-note">Everyone can explore the games. Editing is reserved for the administrator.</p></div>
      <div class="modal-footer"><button class="button secondary" type="button" :disabled="busy" @click="emit('close')">Continue browsing</button><span class="spacer"></span><button class="button primary" type="submit" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button></div>
    </form>
  </dialog>
</template>
