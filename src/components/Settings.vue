<script setup>
import { ref, computed } from 'vue'
import { 
  state, 
  DEFAULT_TYPES, 
  DEFAULT_CATS, 
  APP_FEATURES,
  DEFAULT_USER_PERMS,
  currentUser, 
  isAdmin, 
  isUser,
  addUser,
  updateUser,
  deleteUser,
  canAccess,
  syncStatus,
  pushToGoogleSheets,
  fetchFromGoogleSheets,
  showToast,
  askConfirm
} from '../store'

const emit = defineEmits(['open-role-modal'])

const newType = ref('')
const newCat = ref('')
const notifySaved = ref(false)

// PIN Security States
const newAdminPin = ref('')
const newUserPin = ref('')

// Google Sheets Test & Sync Feedback
const testingUrl = ref(false)
const testResult = ref(null)
const sheetsFeedback = ref(null)

function saveSettings() {
  notifySaved.value = true
  setTimeout(() => { notifySaved.value = false }, 3000)
}

function addMushroomType() {
  const t = newType.value.trim()
  if (!t) return
  if (!state.settings.types.includes(t)) {
    state.settings.types.push(t)
    newType.value = ''
    saveSettings()
  }
}

function removeMushroomType(index) {
  if (state.settings.types.length <= 1) {
    alert('ត្រូវមានយ៉ាងហោចណាស់ប្រភេទផ្សិតមួយ!')
    return
  }
  state.settings.types.splice(index, 1)
  saveSettings()
}

function addExpenseCat() {
  const c = newCat.value.trim()
  if (!c) return
  if (!state.settings.cats.includes(c)) {
    state.settings.cats.push(c)
    newCat.value = ''
    saveSettings()
  }
}

function removeExpenseCat(index) {
  if (state.settings.cats.length <= 1) {
    alert('ត្រូវមានយ៉ាងហោចណាស់ប្រភេទចំណាយមួយ!')
    return
  }
  state.settings.cats.splice(index, 1)
  saveSettings()
}

function updateAdminPin() {
  const p = newAdminPin.value.trim()
  if (!p || p.length < 4) {
    alert('លេខ PIN Admin ត្រូវមានយ៉ាងហោចណាស់ ៤ ខ្ទង់!')
    return
  }
  state.settings.adminPin = p
  newAdminPin.value = ''
  saveSettings()
  alert('លេខកូដ PIN Admin ត្រូវបានប្តូរជោគជ័យ! លេខថ្មីគឺ៖ ' + p)
}

function updateUserPin() {
  const p = newUserPin.value.trim()
  state.settings.userPin = p
  newUserPin.value = ''
  saveSettings()
  alert(p ? 'បានកំណត់លេខ PIN បុគ្គលិកជោគជ័យ!' : 'បានដកលេខ PIN បុគ្គលិក (អាចចូលដោយសេរី)។')
}

// Google Sheets Actions
async function handleSettingsPush() {
  if (syncStatus.loading) return
  const res = await pushToGoogleSheets()
  sheetsFeedback.value = {
    success: res.success,
    message: res.success 
      ? 'ទិន្នន័យ (វគ្គ, ផល, ចំណូល, ចំណាយ) ត្រូវបាន Sync ទៅ Google Sheets ជោគជ័យ!' 
      : 'បរាជ័យក្នុងការ Sync៖ ' + res.message
  }
  setTimeout(() => { sheetsFeedback.value = null }, 5000)
}

async function handleSettingsPull() {
  if (syncStatus.loading) return
  if (confirm('តើអ្នកចង់ទាញយកទិន្នន័យពី Google Sheets មកជំនួសទិន្នន័យលើឧបករណ៍នេះមែនទេ?')) {
    const res = await fetchFromGoogleSheets()
    sheetsFeedback.value = {
      success: res.success,
      message: res.success 
        ? 'ទិន្នន័យពី Google Sheets ត្រូវបានទាញយក និងអាប់ដេតលើ Dashboard ជោគជ័យ!' 
        : 'បរាជ័យក្នុងការទាញយក៖ ' + res.message
    }
    setTimeout(() => { sheetsFeedback.value = null }, 5000)
  }
}

async function testGoogleSheetsUrl() {
  testingUrl.value = true
  testResult.value = null
  try {
    const res = await fetch(state.settings.googleScriptUrl)
    const json = await res.json()
    if (json && typeof json === 'object') {
      testResult.value = { success: true, message: 'ការតភ្ជាប់ទៅកាន់ Google Sheets ជោគជ័យ ១០០%!' }
    } else {
      testResult.value = { success: false, message: 'Google Sheets ឆ្លើយតបមកវិញមិនត្រឹមត្រូវ' }
    }
  } catch (err) {
    testResult.value = { success: false, message: 'បរាជ័យក្នុងការតភ្ជាប់៖ ' + err.message }
  } finally {
    testingUrl.value = false
    setTimeout(() => { testResult.value = null }, 6000)
  }
}

// User Accounts & Permissions Management
const showUserModal = ref(false)
const isEditingUser = ref(false)
const showUserPinInModal = ref(false)
const visibleUserPins = ref({})

const userForm = ref({
  id: null,
  name: '',
  username: '',
  pin: '1234',
  role: 'user',
  status: 'active',
  address: '',
  permissions: { ...DEFAULT_USER_PERMS }
})

function openAddUserModal() {
  isEditingUser.value = false
  showUserPinInModal.value = false
  userForm.value = {
    id: null,
    name: '',
    username: '',
    pin: '0000',
    role: 'user',
    status: 'active',
    address: '',
    permissions: { ...DEFAULT_USER_PERMS }
  }
  showUserModal.value = true
}

function openEditUserModal(user) {
  isEditingUser.value = true
  showUserPinInModal.value = false
  userForm.value = {
    id: user.id,
    name: user.name,
    username: user.username || '',
    pin: user.pin || '',
    role: user.role || 'user',
    status: user.status || 'active',
    address: user.address || '',
    permissions: user.permissions ? { ...user.permissions } : { ...DEFAULT_USER_PERMS }
  }
  showUserModal.value = true
}

function togglePinVisibility(userId) {
  visibleUserPins.value[userId] = !visibleUserPins.value[userId]
}

function togglePerm(key) {
  if (userForm.value.role === 'admin') return
  userForm.value.permissions[key] = !userForm.value.permissions[key]
}

function selectAllPerms() {
  APP_FEATURES.forEach(f => {
    userForm.value.permissions[f.key] = true
  })
}

function selectDefaultOpsPerms() {
  APP_FEATURES.forEach(f => {
    userForm.value.permissions[f.key] = DEFAULT_USER_PERMS[f.key] ?? false
  })
}

function clearAllPerms() {
  APP_FEATURES.forEach(f => {
    userForm.value.permissions[f.key] = false
  })
}

function handleSaveUser() {
  if (!userForm.value.name.trim()) {
    showToast('សូមបញ្ចូលឈ្មោះអ្នកប្រើប្រាស់!', 'error', 'ខ្វះទិន្នន័យ')
    return
  }
  if (!userForm.value.username.trim()) {
    showToast('សូមបញ្ចូលឈ្មោះចូលប្រើ (Username)!', 'error', 'ខ្វះទិន្នន័យ')
    return
  }

  if (isEditingUser.value) {
    const res = updateUser(userForm.value.id, userForm.value)
    if (res.success) {
      showToast('បានកែប្រែព័ត៌មាន និងសិទ្ធិគណនី «' + userForm.value.name + '» ជោគជ័យ!', 'success', 'កែប្រែ User')
      showUserModal.value = false
    } else {
      showToast(res.message, 'error', 'បរាជ័យ')
    }
  } else {
    const res = addUser(userForm.value)
    if (res.success) {
      showToast('បានបង្កើតគណនី «' + userForm.value.name + '» ដោយជោគជ័យ!', 'success', 'បង្កើត User')
      showUserModal.value = false
    } else {
      showToast(res.message, 'error', 'បរាជ័យ')
    }
  }
}

async function handleDeleteUser(user) {
  const ok = await askConfirm({
    title: 'លុបគណនីអ្នកប្រើប្រាស់',
    message: 'តើអ្នកពិតជាចង់លុបគណនី «' + user.name + ' (@' + user.username + ')» ចេញពីប្រព័ន្ធមែនទេ?',
    confirmText: 'លុបគណនី',
    type: 'danger'
  })
  if (ok) {
    const res = deleteUser(user.id)
    if (res.success) {
      showToast('បានលុបគណនី «' + user.name + '» រួចរាល់!', 'info', 'លុប User')
    } else {
      showToast(res.message, 'error', 'មិនអាចលុបបាន')
    }
  }
}

const activeUsersCount = computed(() => (state.users || []).filter(u => u.status === 'active').length)
const adminUsersCount = computed(() => (state.users || []).filter(u => u.role === 'admin').length)
const staffUsersCount = computed(() => (state.users || []).filter(u => u.role === 'user').length)

</script>

<template>
  <div class="settings-container">
    <!-- Toast notification -->
    <div v-if="notifySaved" class="toast-box">
      <i class="fa-solid fa-circle-check"></i>
      <span>ការកំណត់ត្រូវបានរក្សាទុកដោយស្វ័យប្រវត្តិ!</span>
    </div>

    <!-- Header -->
    <div class="card">
      <div class="card-head">
        <div>
          <h2><i class="fa-solid fa-gear text-emerald"></i> ការកំណត់ប្រព័ន្ធ & Admin Settings</h2>
          <p class="subtitle">គ្រប់គ្រងគណនី Role, សមកាលកម្ម Google Sheets Cloud, ព័ត៌មានកសិដ្ឋាន និងសុវត្ថិភាព PIN</p>
        </div>
      </div>
    </div>

    <!-- Top Features Moved from Sidebar into Settings -->
    <div class="grid-2-cols mb-4">
      <!-- 1. Current Account & Role Profile Card -->
      <div class="card settings-feature-card">
        <div class="feature-card-header">
          <div class="feature-avatar" :class="isAdmin ? 'avatar-admin' : 'avatar-user'">
            <i :class="isAdmin ? 'fa-solid fa-user-shield' : 'fa-solid fa-user'"></i>
          </div>
          <div class="feature-card-title-box">
            <span class="feature-sublabel">គណនីបច្ចុប្បន្ន</span>
            <h3 class="feature-username">{{ currentUser.name }}</h3>
            <span class="user-role-badge" :class="isAdmin ? 'badge-admin' : 'badge-user'">
              {{ isAdmin ? '👑 អ្នកគ្រប់គ្រង (Admin)' : '👤 បុគ្គលិកកត់ត្រា (User)' }}
            </span>
            <span v-if="state.settings.address" class="text-mu text-xs mt-1 d-flex align-center gap-1">
              <i class="fa-solid fa-location-dot text-emerald"></i> {{ state.settings.address }}
            </span>
          </div>
        </div>

        <div class="feature-card-footer mt-3">
          <button class="btn btn-outline w-full" @click="$emit('open-role-modal')">
            <i class="fa-solid fa-right-left"></i>
            <span>ប្តូរតួនាទី (Switch Role)</span>
          </button>
        </div>
      </div>

      <!-- 2. Google Sheets Cloud Live Sync Card -->
      <div class="card settings-feature-card border-sheets">
        <div class="feature-card-header">
          <div class="feature-avatar avatar-sheets">
            <i class="fa-solid fa-file-excel"></i>
          </div>
          <div class="feature-card-title-box">
            <div class="d-flex align-center gap-2">
              <h3 class="feature-username">Google Sheets Cloud</h3>
              <span class="sheets-live-pill"><i class="fa-solid fa-circle text-xs"></i> ភ្ជាប់រួច</span>
            </div>
            <span class="feature-sync-time">
              {{ syncStatus.lastSynced ? 'បាន Sync: ' + syncStatus.lastSynced : 'មិនទាន់ Sync នៅឡើយ' }}
            </span>
          </div>
        </div>

        <div class="feature-card-actions mt-3">
          <button 
            class="btn btn-primary w-full" 
            :disabled="syncStatus.loading" 
            @click="handleSettingsPush"
          >
            <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': syncStatus.loading }"></i>
            <span>{{ syncStatus.loading ? 'កំពុង Sync...' : 'Sync ទៅ Google Sheets' }}</span>
          </button>
          <button 
            class="btn btn-outline w-full mt-2" 
            :disabled="syncStatus.loading" 
            @click="handleSettingsPull"
          >
            <i class="fa-solid fa-cloud-arrow-down"></i>
            <span>ទាញយកពី Sheets (Pull)</span>
          </button>
        </div>

        <div v-if="sheetsFeedback" class="alert-box mt-2" :class="sheetsFeedback.success ? 'alert-success' : 'alert-error'">
          <i class="fa-solid" :class="sheetsFeedback.success ? 'fa-circle-check' : 'fa-circle-xmark'"></i>
          <span class="text-xs">{{ sheetsFeedback.message }}</span>
        </div>
      </div>
    </div>

    <!-- Main Settings Grid -->
    <div class="settings-grid">
      <!-- 0. User Accounts & Permissions Management -->
      <div class="card col-span-2">
        <div class="card-head">
          <div>
            <h3 class="section-title"><i class="fa-solid fa-users text-emerald"></i> គ្រប់គ្រងគណនី & សិទ្ធិប្រើប្រាស់ (User Accounts & Roles)</h3>
            <p class="card-desc">បង្កើតគណនី Admin ឬ User, កំណត់លេខកូដសម្ងាត់ PIN និងកំណត់សិទ្ធិចូលមើលមុខងារនីមួយៗ</p>
          </div>
          <div class="d-flex align-center gap-2 flex-wrap">
            <button class="btn btn-primary" @click="openAddUserModal">
              <i class="fa-solid fa-user-plus"></i>
              <span>បង្កើតគណនីថ្មី</span>
            </button>
          </div>
        </div>

        <!-- Summary Pills Row -->
        <div class="d-flex align-center gap-2 flex-wrap my-3">
          <span class="badge-role bg-emerald-light text-emerald font-bold">
            <i class="fa-solid fa-users-gear"></i> សរុប {{ state.users.length }} គណនី
          </span>
          <span class="badge-role bg-emerald-light text-emerald">
            👑 Admin {{ adminUsersCount }}
          </span>
          <span class="badge-role bg-blue-light text-blue">
            👤 Staff/User {{ staffUsersCount }}
          </span>
          <span class="badge-role bg-bg text-mu border">
            🟢 សកម្ម {{ activeUsersCount }}
          </span>
        </div>

        <!-- User Accounts Table -->
        <div class="scroll-table-wrapper border rounded-lg">
          <table class="data-table">
            <thead>
              <tr>
                <th>ឈ្មោះ & គណនី</th>
                <th class="text-center">តួនាទី (Role)</th>
                <th class="text-center">លេខ PIN</th>
                <th>សិទ្ធិប្រើប្រាស់មុខងារ</th>
                <th class="text-center">ស្ថានភាព</th>
                <th class="text-center">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in state.users" :key="u.id">
                <td>
                  <div class="d-flex align-center gap-2">
                    <div class="user-avatar-sm" :class="u.role === 'admin' ? 'bg-emerald-light text-emerald' : 'bg-blue-light text-blue'">
                      <i :class="u.role === 'admin' ? 'fa-solid fa-crown' : 'fa-solid fa-user'"></i>
                    </div>
                    <div>
                      <div class="d-flex align-center gap-1">
                        <b>{{ u.name }}</b>
                        <span v-if="currentUser.userId === u.id" class="badge-current-you">គណនីអ្នក</span>
                      </div>
                      <span class="text-mu text-xs font-mono">@{{ u.username || 'user' + u.id }}</span>
                      <small v-if="u.address" class="text-mu text-xs d-block"><i class="fa-solid fa-location-dot"></i> {{ u.address }}</small>
                    </div>
                  </div>
                </td>
                <td class="text-center">
                  <span class="user-role-badge" :class="u.role === 'admin' ? 'badge-admin' : 'badge-user'">
                    {{ u.role === 'admin' ? '👑 Admin' : '👤 User' }}
                  </span>
                </td>
                <td class="text-center">
                  <div class="d-flex align-center justify-center gap-1">
                    <span class="pin-display">{{ visibleUserPins[u.id] ? (u.pin || 'គ្មាន PIN') : '••••' }}</span>
                    <button type="button" class="icon-mini-btn" :title="visibleUserPins[u.id] ? 'លាក់ PIN' : 'បង្ហាញ PIN'" @click="togglePinVisibility(u.id)">
                      <i class="fa-solid" :class="visibleUserPins[u.id] ? 'fa-eye-slash' : 'fa-eye'"></i>
                    </button>
                  </div>
                </td>
                <td>
                  <div v-if="u.role === 'admin'" class="text-emerald font-bold text-xs d-flex align-center gap-1">
                    <i class="fa-solid fa-circle-check"></i> ពេញលេញគ្រប់មុខងារ (100%)
                  </div>
                  <div v-else class="user-perms-pills">
                    <span 
                      v-for="f in APP_FEATURES" 
                      :key="f.key"
                      class="perm-micro-pill"
                      :class="{ allowed: u.permissions && u.permissions[f.key] }"
                      :title="f.name"
                    >
                      <i :class="f.icon"></i>
                      <span>{{ f.key }}</span>
                    </span>
                  </div>
                </td>
                <td class="text-center">
                  <span class="badge-role" :class="u.status === 'active' ? 'badge-admin' : 'bg-danger-light text-danger'">
                    {{ u.status === 'active' ? '🟢 សកម្ម' : '🔴 ផ្អាក' }}
                  </span>
                </td>
                <td class="text-center">
                  <div class="d-flex justify-center align-center gap-1">
                    <button class="btn btn-outline btn-xs" title="កែប្រែព័ត៌មាន និងសិទ្ធិ" @click="openEditUserModal(u)">
                      <i class="fa-solid fa-pen-to-square"></i> កែប្រែ
                    </button>
                    <button 
                      class="btn btn-outline btn-xs text-danger" 
                      title="លុបគណនីនេះ"
                      :disabled="(u.role === 'admin' && adminUsersCount <= 1) || currentUser.userId === u.id" 
                      @click="handleDeleteUser(u)"
                    >
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3. Google Sheets URL Configuration -->
      <div class="card col-span-2">
        <h3 class="section-title"><i class="fa-solid fa-link text-emerald"></i> អាសយដ្ឋាន Web App URL របស់ Google Sheets</h3>
        <p class="card-desc mb-3">Google Apps Script Web App URL សម្រាប់ភ្ជាប់ទិន្នន័យកសិដ្ឋាន</p>

        <div class="form-group">
          <div class="d-flex gap-2">
            <input 
              v-model="state.settings.googleScriptUrl" 
              class="form-control" 
              placeholder="https://script.google.com/macros/s/.../exec"
              @change="saveSettings"
            />
            <button class="btn btn-primary" :disabled="testingUrl" @click="testGoogleSheetsUrl">
              <i class="fa-solid" :class="testingUrl ? 'fa-spinner fa-spin' : 'fa-network-wired'"></i>
              <span>{{ testingUrl ? 'កំពុងតេស្ត...' : 'តេស្តការតភ្ជាប់' }}</span>
            </button>
          </div>

          <!-- Auto-Sync Toggle -->
          <div class="auto-sync-toggle-box mt-3 p-3 bg-bg border rounded-lg d-flex align-center justify-between">
            <div class="d-flex align-center gap-3">
              <div class="icon-circle bg-emerald-light text-emerald" style="width: 36px; height: 36px; font-size: 16px;">
                <i class="fa-solid fa-bolt-auto"></i>
              </div>
              <div>
                <b>សមកាលកម្មស្វ័យប្រវត្តិ (Auto-sync to Google Sheets)</b>
                <p class="text-mu text-xs mt-1">រាល់ពេលកត់ត្រា ឬកែប្រែទិន្នន័យ ប្រព័ន្ធនឹងបញ្ជូនទៅ Google Sheets ដោយស្វ័យប្រវត្តិ។</p>
              </div>
            </div>
            <label class="switch-toggle">
              <input type="checkbox" v-model="state.settings.autoSync" @change="saveSettings" />
              <span class="slider"></span>
            </label>
          </div>

          <div v-if="testResult" class="alert-box mt-3" :class="testResult.success ? 'alert-success' : 'alert-error'">
            <i class="fa-solid" :class="testResult.success ? 'fa-circle-check' : 'fa-circle-xmark'"></i>
            <span>{{ testResult.message }}</span>
          </div>
        </div>
      </div>

      <!-- 4. Roles & Permissions Table -->
      <div class="card col-span-2">
        <h3 class="section-title"><i class="fa-solid fa-users-gear text-emerald"></i> តារាងសិទ្ធិប្រើប្រាស់ (Permissions Table)</h3>
        <div class="roles-table-wrapper mt-2">
          <table class="data-table">
            <thead>
              <tr>
                <th>មុខងារ និងសិទ្ធិប្រើប្រាស់</th>
                <th class="text-center">👑 Admin (អ្នកគ្រប់គ្រង)</th>
                <th class="text-center">👤 User (បុគ្គលិក)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>មើលផ្ទាំងគ្រប់គ្រង (Dashboard)</td>
                <td class="text-center text-inc"><i class="fa-solid fa-circle-check"></i> ពេញលេញ</td>
                <td class="text-center text-inc"><i class="fa-solid fa-circle-check"></i> ពេញលេញ</td>
              </tr>
              <tr>
                <td>កត់ត្រាផល, វគ្គ, ចំណូល និងចំណាយ</td>
                <td class="text-center text-inc"><i class="fa-solid fa-circle-check"></i> បន្ថែម & កែប្រែ</td>
                <td class="text-center text-inc"><i class="fa-solid fa-circle-check"></i> បន្ថែម & កែប្រែ</td>
              </tr>
              <tr>
                <td>លុបទិន្នន័យជួរដេក ឬវគ្គ (Delete Records)</td>
                <td class="text-center text-inc"><i class="fa-solid fa-circle-check"></i> អនុញ្ញាត</td>
                <td class="text-center text-danger"><i class="fa-solid fa-circle-xmark"></i> គ្មានសិទ្ធិ</td>
              </tr>
              <tr>
                <td>មើល និងបោះពុម្ពរបាយការណ៍ (Reports)</td>
                <td class="text-center text-inc"><i class="fa-solid fa-circle-check"></i> អនុញ្ញាត</td>
                <td class="text-center text-inc"><i class="fa-solid fa-circle-check"></i> អនុញ្ញាត</td>
              </tr>
              <tr>
                <td>Sync Google Sheets & បម្រុងទុក (Backup / Restore)</td>
                <td class="text-center text-inc"><i class="fa-solid fa-circle-check"></i> អនុញ្ញាត</td>
                <td class="text-center text-danger"><i class="fa-solid fa-circle-xmark"></i> គ្មានសិទ្ធិ</td>
              </tr>
              <tr>
                <td>ការកំណត់ទូទៅ និង PIN (Settings)</td>
                <td class="text-center text-inc"><i class="fa-solid fa-circle-check"></i> អនុញ្ញាត</td>
                <td class="text-center text-danger"><i class="fa-solid fa-circle-xmark"></i> គ្មានសិទ្ធិ</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 5. Admin & User PIN Management -->
      <div class="card">
        <h3 class="section-title"><i class="fa-solid fa-key text-blue"></i> សុវត្ថិភាពលេខកូដសម្ងាត់ (PINs)</h3>
        <p class="card-desc mb-3">កំណត់លេខកូដសម្ងាត់សម្រាប់ប្តូរ Role ទៅជា Admin ឬ User</p>

        <div class="form-vertical">
          <!-- Admin PIN -->
          <div class="form-group border-bottom pb-3">
            <label class="label-text">
              <i class="fa-solid fa-crown text-emerald"></i> លេខកូដសម្ងាត់ Admin (Admin PIN)
            </label>
            <div class="d-flex gap-2 mt-1">
              <input 
                type="password" 
                v-model="newAdminPin" 
                maxlength="8" 
                class="form-control" 
                placeholder="បញ្ចូល PIN Admin ថ្មី..."
              />
              <button class="btn btn-primary" @click="updateAdminPin">ប្តូរ PIN</button>
            </div>
            <small class="text-mu mt-1">បច្ចុប្បន្ន៖ <b>{{ state.settings.adminPin }}</b> (ទាមទារពេលចូល Admin)</small>
          </div>

          <!-- User PIN -->
          <div class="form-group pt-2">
            <label class="label-text">
              <i class="fa-solid fa-user text-blue"></i> លេខកូដបុគ្គលិក (Staff PIN - មិនបង្ខំ)
            </label>
            <div class="d-flex gap-2 mt-1">
              <input 
                type="password" 
                v-model="newUserPin" 
                maxlength="8" 
                class="form-control" 
                placeholder="PIN បុគ្គលិក (ទទេបើមិនប្រើ)..."
              />
              <button class="btn btn-outline" @click="updateUserPin">រក្សាទុក</button>
            </div>
            <small class="text-mu mt-1">ស្ថានភាព៖ <b>{{ state.settings.userPin ? 'មាន PIN' : 'គ្មាន PIN (ចូលដោយសេរី)' }}</b></small>
          </div>
        </div>
      </div>

      <!-- 6. Farm Profile -->
      <div class="card">
        <h3 class="section-title"><i class="fa-solid fa-seedling text-emerald"></i> ព័ត៌មានកសិដ្ឋាន</h3>
        <p class="card-desc mb-3">បង្ហាញលើក្បាលទំព័រ និងការបោះពុម្ពរបាយការណ៍</p>

        <div class="form-vertical">
          <div class="form-group">
            <label class="label-text"><i class="fa-solid fa-font"></i> ឈ្មោះកសិដ្ឋាន</label>
            <input v-model="state.settings.farmName" class="form-control" placeholder="ឧ. កសិដ្ឋានផ្សិតធម្មជាតិ" @change="saveSettings" />
          </div>

          <div class="form-group">
            <label class="label-text"><i class="fa-solid fa-user-tie"></i> ឈ្មោះម្ចាស់កសិដ្ឋាន</label>
            <input v-model="state.settings.owner" class="form-control" placeholder="ឧ. លោក សុខ ចិន្តា" @change="saveSettings" />
          </div>

          <div class="form-group">
            <label class="label-text"><i class="fa-solid fa-phone"></i> លេខទូរស័ព្ទ</label>
            <input v-model="state.settings.phone" class="form-control" placeholder="ឧ. 012 345 678" @change="saveSettings" />
          </div>

          <div class="form-group">
            <label class="label-text"><i class="fa-solid fa-location-dot text-emerald"></i> អាសយដ្ឋានកសិដ្ឋាន (Farm Address)</label>
            <textarea 
              v-model="state.settings.address" 
              class="form-control" 
              rows="2" 
              placeholder="ឧ. ភូមិ... ឃុំ/សង្កាត់... ស្រុក/ខណ្ឌ... ខេត្ត/រាជធានី..." 
              @change="saveSettings"
            ></textarea>
            <small class="text-mu mt-1">អាសយដ្ឋាននេះនឹងបង្ហាញលើក្បាលទំព័ររបាយការណ៍ផ្លូវការពេលបោះពុម្ព (Print Report)</small>
          </div>
        </div>
      </div>

      <!-- 7. Mushroom Species Management -->
      <div class="card">
        <h3 class="section-title"><i class="fa-solid fa-shapes text-purple"></i> ប្រភេទផ្សិតដាំដុះ</h3>
        <p class="card-desc mb-3">ប្រភេទផ្សិតសម្រាប់ជ្រើសរើសពេលបង្កើតវគ្គ</p>

        <div class="tags-container">
          <span v-for="(t, i) in state.settings.types" :key="t" class="tag-pill">
            <span>{{ t }}</span>
            <button class="tag-del" @click="removeMushroomType(i)">✕</button>
          </span>
        </div>

        <form class="add-tag-form mt-3" @submit.prevent="addMushroomType">
          <input v-model="newType" class="form-control" placeholder="បន្ថែមប្រភេទផ្សិតថ្មី..." />
          <button class="btn btn-outline" type="submit">
            <i class="fa-solid fa-plus"></i> បន្ថែម
          </button>
        </form>
      </div>

      <!-- 8. Expense Categories Management -->
      <div class="card">
        <h3 class="section-title"><i class="fa-solid fa-tags text-exp"></i> ប្រភេទចំណាយ</h3>
        <p class="card-desc mb-3">ប្រភេទចំណាយសម្រាប់ជ្រើសរើសពេលកត់ត្រា</p>

        <div class="tags-container">
          <span v-for="(c, i) in state.settings.cats" :key="c" class="tag-pill tag-pill-amber">
            <span>{{ c }}</span>
            <button class="tag-del" @click="removeExpenseCat(i)">✕</button>
          </span>
        </div>

        <form class="add-tag-form mt-3" @submit.prevent="addExpenseCat">
          <input v-model="newCat" class="form-control" placeholder="បន្ថែមប្រភេទចំណាយថ្មី..." />
          <button class="btn btn-outline" type="submit">
            <i class="fa-solid fa-plus"></i> បន្ថែម
          </button>
        </form>
      </div>
    </div>
  
    <!-- ===================================================================== -->
    <!-- MODAL: CREATE / EDIT USER & PERMISSIONS -->
    <!-- ===================================================================== -->
    <div v-if="showUserModal" class="modal-backdrop" @click.self="showUserModal = false">
      <div class="modal-card modal-lg">
        <div class="modal-header">
          <div class="d-flex align-center gap-2">
            <div class="feature-avatar" :class="userForm.role === 'admin' ? 'avatar-admin' : 'avatar-user'" style="width: 36px; height: 36px; font-size: 16px;">
              <i :class="userForm.role === 'admin' ? 'fa-solid fa-crown' : 'fa-solid fa-user'"></i>
            </div>
            <div>
              <h3>{{ isEditingUser ? 'កែប្រែព័ត៌មាន & សិទ្ធិគណនី' : 'បង្កើតគណនីអ្នកប្រើប្រាស់ថ្មី' }}</h3>
              <p class="subtitle">កំណត់ឈ្មោះចូលប្រើ, លេខសម្ងាត់ PIN, តួនាទី និងសិទ្ធិចូលមើលមុខងារ</p>
            </div>
          </div>
          <button class="icon-btn" @click="showUserModal = false"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form @submit.prevent="handleSaveUser">
          <div class="modal-body modal-scroll">
            <!-- Account Info Row -->
            <div class="grid-2-cols mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-id-card"></i> ឈ្មោះពេញ (Full Name) *</label>
                <input v-model="userForm.name" type="text" class="form-control" placeholder="ឧ. សុខ ចាន់ថា" required />
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-at"></i> ឈ្មោះសម្គាល់ចូលប្រើ (Username) *</label>
                <input v-model="userForm.username" type="text" class="form-control font-mono" placeholder="ឧ. chantha" required />
              </div>
            </div>

            <div class="grid-3-cols mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-shield"></i> តួនាទី (Role) *</label>
                <select v-model="userForm.role" class="form-control" required>
                  <option value="user">👤 បុគ្គលិកកត់ត្រា (User)</option>
                  <option value="admin">👑 អ្នកគ្រប់គ្រង (Admin)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-key"></i> លេខកូដសម្ងាត់ (PIN/Password)</label>
                <div class="d-flex align-center gap-1">
                  <input 
                    :type="showUserPinInModal ? 'text' : 'password'" 
                    v-model="userForm.pin" 
                    maxlength="16" 
                    class="form-control font-mono" 
                    placeholder="បញ្ចូលលេខសម្ងាត់..." 
                  />
                  <button type="button" class="btn btn-outline btn-sm px-2" @click="showUserPinInModal = !showUserPinInModal">
                    <i class="fa-solid" :class="showUserPinInModal ? 'fa-eye-slash' : 'fa-eye'"></i>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-circle-check"></i> ស្ថានភាពគណនី</label>
                <select v-model="userForm.status" class="form-control">
                  <option value="active">សកម្ម (Active)</option>
                  <option value="inactive">ផ្អាកដំណើរការ (Inactive)</option>
                </select>
              </div>
            </div>

            <!-- User Address / Location Field -->
            <div class="form-group mb-3">
              <label class="label-text"><i class="fa-solid fa-location-dot text-emerald"></i> អាសយដ្ឋាន / ទីលំនៅ (Address - មិនបង្ខំ)</label>
              <input v-model="userForm.address" type="text" class="form-control" placeholder="ឧ. រាជធានីភ្នំពេញ, ខេត្តកណ្តាល..." />
            </div>

            <!-- Permissions Configuration Section -->
            <div class="permissions-config-box mt-4 p-3 border rounded-lg bg-bg">
              <div class="d-flex justify-between align-center flex-wrap gap-2 mb-2 pb-2 border-bottom">
                <div>
                  <h4 class="font-bold text-sm"><i class="fa-solid fa-sliders text-emerald"></i> កំណត់សិទ្ធិចូលប្រើមុខងារ (Feature Permissions)</h4>
                  <p class="text-mu text-xs">ជ្រើសរើសមុខងារដែល User នេះមានសិទ្ធិចូលមើល និងកត់ត្រា</p>
                </div>
                <div v-if="userForm.role === 'user'" class="d-flex gap-1">
                  <button type="button" class="btn btn-outline btn-xs" @click="selectAllPerms">ជ្រើសទាំងអស់</button>
                  <button type="button" class="btn btn-outline btn-xs" @click="selectDefaultOpsPerms">ប្រតិបត្តិការទូទៅ</button>
                  <button type="button" class="btn btn-outline btn-xs text-danger" @click="clearAllPerms">សម្អាត</button>
                </div>
              </div>

              <!-- Admin Notice -->
              <div v-if="userForm.role === 'admin'" class="alert-box alert-success my-2">
                <i class="fa-solid fa-circle-check"></i>
                <span class="text-xs">គណនី Admin មានសិទ្ធិចូលប្រើប្រាស់គ្រប់មុខងារទាំងអស់ក្នុងប្រព័ន្ធដោយស្វ័យប្រវត្តិ (រួមទាំងការកំណត់ និង Backup)។</span>
              </div>

              <!-- User Feature Toggles Grid -->
              <div class="features-toggles-grid" :class="{ 'opacity-60 pointer-events-none': userForm.role === 'admin' }">
                <div 
                  v-for="feat in APP_FEATURES" 
                  :key="feat.key"
                  class="feature-toggle-card"
                  :class="{ selected: userForm.role === 'admin' || userForm.permissions[feat.key] }"
                  @click="togglePerm(feat.key)"
                >
                  <div class="feature-toggle-head">
                    <div class="d-flex align-center gap-2">
                      <div class="feat-icon-box">
                        <i :class="feat.icon"></i>
                      </div>
                      <b class="feat-name">{{ feat.name }}</b>
                    </div>
                    <input 
                      type="checkbox" 
                      :checked="userForm.role === 'admin' || userForm.permissions[feat.key]" 
                      :disabled="userForm.role === 'admin'"
                      @click.stop
                      @change="userForm.permissions[feat.key] = $event.target.checked" 
                    />
                  </div>
                  <p class="feat-desc">{{ feat.desc }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showUserModal = false">បោះបង់</button>
            <button type="submit" class="btn btn-primary">
              <i class="fa-solid fa-check"></i>
              <span>{{ isEditingUser ? 'រក្សាទុកការកែប្រែ' : 'បង្កើតគណនី User' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

