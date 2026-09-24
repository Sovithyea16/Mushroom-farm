<script setup>
import { ref, computed } from 'vue'
import { state, authState, login, showToast } from '../store'

const activeUsers = computed(() => (state.users || []).filter(u => u.status === 'active'))
const selectedUserId = ref(activeUsers.value.length ? activeUsers.value[0].id : 1)
const selectedUser = computed(() => activeUsers.value.find(u => u.id === selectedUserId.value) || activeUsers.value[0])

const pin = ref('')
const showPassword = ref(false)
const errorMsg = ref('')
const loading = ref(false)

function selectUser(user) {
  selectedUserId.value = user.id
  pin.value = ''
  errorMsg.value = ''
}

function handleLogin() {
  errorMsg.value = ''
  loading.value = true

  setTimeout(() => {
    const res = login(selectedUserId.value, pin.value)
    loading.value = false
    if (res.success) {
      showToast(`ស្វាគមន៍ការចូលប្រើប្រាស់ជា ${res.name}!`, 'success', 'ចូលប្រព័ន្ធជោគជ័យ')
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

      <!-- User Account Selector Grid -->
      <div class="login-user-select-section mt-3">
        <label class="label-text mb-2 text-xs font-bold text-mu text-center d-block">
          <i class="fa-solid fa-users"></i> ជ្រើសរើសគណនីសម្រាប់ចូលប្រើប្រាស់
        </label>
        <div class="login-users-grid">
          <button 
            v-for="u in activeUsers" 
            :key="u.id" 
            type="button" 
            class="login-user-card" 
            :class="{ active: selectedUserId === u.id }"
            @click="selectUser(u)"
          >
            <div class="user-avatar-circle" :class="u.role === 'admin' ? 'bg-emerald-light text-emerald' : 'bg-blue-light text-blue'">
              <i :class="u.role === 'admin' ? 'fa-solid fa-crown' : 'fa-solid fa-user'"></i>
            </div>
            <div class="user-meta">
              <b class="user-name">{{ u.name }}</b>
              <span class="user-role-text" :class="u.role === 'admin' ? 'text-emerald' : 'text-blue'">
                {{ u.role === 'admin' ? '👑 Admin' : '👤 Staff (@' + u.username + ')' }}
              </span>
            </div>
            <i v-if="selectedUserId === u.id" class="fa-solid fa-circle-check user-check-icon text-emerald"></i>
          </button>
        </div>
      </div>

      <!-- Login Form -->
      <form class="login-form mt-4" @submit.prevent="handleLogin">
        <!-- Error Alert -->
        <div v-if="errorMsg" class="alert-box alert-error mb-3">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>{{ errorMsg }}</span>
        </div>

        <div class="form-group" v-if="selectedUser">
          <label class="label-text">
            <i class="fa-solid fa-key"></i>
            <span>លេខកូដសម្ងាត់ PIN សម្រាប់ {{ selectedUser.name }}</span>
          </label>

          <div class="password-input-wrap">
            <input 
              :type="showPassword ? 'text' : 'password'"
              v-model="pin"
              maxlength="16"
              class="form-control text-center font-bold text-xl tracking-widest"
              :placeholder="selectedUser.pin ? 'បញ្ចូលលេខសម្ងាត់ PIN...' : 'គណនីនេះគ្មាន PIN ទេ (ចុចចូល)'"
              autofocus
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
        <span>Admin លំនាំដើម៖ <b>1234</b> | បុគ្គលិក Staff៖ <b>0000</b> (ឬចុចចូលផ្ទាល់)</span>
      </div>
    </div>
  </div>
</template>
