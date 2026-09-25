<script setup>
import { ref } from 'vue'
import { state, login, showToast } from '../store'

const username = ref('')
const pin = ref('')
const showPassword = ref(false)
const errorMsg = ref('')
const loading = ref(false)

function handleLogin() {
  errorMsg.value = ''
  
  if (!username.value.trim()) {
    errorMsg.value = 'សូមបញ្ចូលឈ្មោះចូលប្រើ (Username)!'
    return
  }

  loading.value = true

  setTimeout(() => {
    const res = login(username.value.trim(), pin.value)
    loading.value = false
    if (res.success) {
      showToast('ស្វាគមន៍ការចូលប្រើប្រាស់ ' + res.name + '!', 'success', 'ចូលប្រព័ន្ធជោគជ័យ')
      pin.value = ''
    } else {
      errorMsg.value = res.message
    }
  }, 200)
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <!-- Brand Logo & Header -->
      <div class="login-header">
        <div class="login-logo-glow">
          <svg viewBox="0 0 512 512" width="48" height="48" fill="currentColor">
            <path d="M318,256H194c-13,0-23,10-23,23v124c0,47,38,85,85,85s85-38,85-85V279C341,266,331,256,318,256z" fill="#38a169"/>
            <path d="M256,23C115,23,0,138,0,279c0,13,10,23,23,23h466c13,0,23-10,23-23C512,138,397,23,256,23z" fill="#2f7d4f"/>
          </svg>
        </div>
        <h1 class="login-title">{{ state.settings.farmName || 'កសិដ្ឋានផ្សិតធម្មជាតិ' }}</h1>
        <p class="login-subtitle">ប្រព័ន្ធគ្រប់គ្រង និងតាមដានផលិតកម្មកសិដ្ឋាន</p>
      </div>

      <!-- Standard Login Form -->
      <form class="login-form mt-4" @submit.prevent="handleLogin">
        <!-- Error Alert -->
        <div v-if="errorMsg" class="alert-box alert-error mb-3">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>{{ errorMsg }}</span>
        </div>

        <!-- Username Input -->
        <div class="form-group mb-3">
          <label class="label-text">
            <i class="fa-solid fa-user"></i>
            <span>ឈ្មោះចូលប្រើ (Username)</span>
          </label>
          <input 
            type="text"
            v-model="username"
            class="form-control"
            placeholder="បញ្ចូលឈ្មោះសម្គាល់ចូលប្រើ (ឧ. admin, staff...)"
            autofocus
            autocomplete="username"
            required
          />
        </div>

        <!-- PIN / Password Input -->
        <div class="form-group mb-3">
          <label class="label-text">
            <i class="fa-solid fa-key"></i>
            <span>លេខកូដសម្ងាត់ (PIN / Password)</span>
          </label>

          <div class="password-input-wrap">
            <input 
              :type="showPassword ? 'text' : 'password'"
              v-model="pin"
              maxlength="16"
              class="form-control"
              placeholder="បញ្ចូលលេខសម្ងាត់ PIN..."
              autocomplete="current-password"
            />
            <button 
              type="button" 
              class="eye-btn" 
              @click="showPassword = !showPassword"
              title="បង្ហាញ/លាក់លេខកូដ"
            >
              <i class="fa-solid" :class="showPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
            </button>
          </div>
        </div>

        <button type="submit" class="btn btn-primary login-btn mt-4 w-full" :disabled="loading">
          <i class="fa-solid" :class="loading ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'"></i>
          <span>{{ loading ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'ចូលប្រើប្រព័ន្ធ (Login)' }}</span>
        </button>
      </form>

      <!-- Credentials Hint Box -->
      <div class="login-hint-box mt-4">
        <i class="fa-solid fa-circle-info text-emerald"></i>
        <span>គណនីគំរូ៖ <b>admin</b> (PIN: 1234) ឬ <b>staff</b> (PIN: 0000)</span>
      </div>
    </div>
  </div>
</template>
