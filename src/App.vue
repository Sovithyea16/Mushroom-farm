<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { state, currentUser, isAdmin, isUser, switchRole, canAccess, syncStatus, pushToGoogleSheets, fetchFromGoogleSheets, initGoogleSheetsSync, toasts, confirmDialog, removeToast, handleConfirmResponse, showToast, authState, logout, askConfirm } from './store'
import Dashboard from './components/Dashboard.vue'
import DataPanel from './components/DataPanel.vue'
import Reports from './components/Reports.vue'
import DataManager from './components/DataManager.vue'
import Settings from './components/Settings.vue'
import WorkersPayroll from './components/WorkersPayroll.vue'
import Inventory from './components/Inventory.vue'
import Login from './components/Login.vue'

// Initialize Google Sheets Database Sync on Startup
onMounted(() => {
  initGoogleSheetsSync()
})

// Operational tabs
const opTabs = [
  ['dash', 'fa-solid fa-chart-pie', 'ផ្ទាំងគ្រប់គ្រង'],
  ['batches', 'fa-solid fa-seedling', 'វគ្គ'],
  ['harvests', 'fa-solid fa-basket-shopping', 'ផលិតកម្ម'],
  ['incomes', 'fa-solid fa-money-bill-trend-up', 'ចំណូល'],
  ['expenses', 'fa-solid fa-receipt', 'ចំណាយ'],
  ['workers', 'fa-solid fa-users-gear', 'កម្មករ & ប្រាក់ឈ្នួល'],
  ['inventory', 'fa-solid fa-boxes-stacked', 'ស្តុកវត្ថុធាតុដើម'],
]

// Management tabs
const mgmtTabs = [
  ['reports', 'fa-solid fa-chart-line', 'របាយការណ៍', false],
  ['data', 'fa-solid fa-database', 'ទិន្នន័យ & Backup', true],
  ['settings', 'fa-solid fa-gear', 'ការកំណត់ Admin', true],
]

const tab = ref('dash')

// Filter tabs according to current user permissions
const visibleOpTabs = computed(() => opTabs.filter(([t]) => canAccess(t)))
const visibleMgmtTabs = computed(() => mgmtTabs.filter(([t, , , adminOnly]) => {
  if (adminOnly && !isAdmin.value) return false
  return canAccess(t)
}))

watch(() => [authState.role, authState.permissions], () => {
  if (!canAccess(tab.value)) {
    const firstAllowed = opTabs.find(([t]) => canAccess(t))
    tab.value = firstAllowed ? firstAllowed[0] : 'dash'
  }
}, { deep: true })

const sideOpen = ref(false)

// Role Switch Modal & Pending Navigation
const showRoleModal = ref(false)
const selectedTargetUser = ref(1)
const pinInput = ref('')
const roleError = ref('')
const pendingTab = ref(null)

function getTabTitle(key) {
  const all = [...opTabs, ...mgmtTabs]
  const found = all.find(item => item[0] === key)
  return found ? found[2] : key
}

function openRoleModal() {
  selectedTargetUser.value = state.users.find(u => u.id !== currentUser.userId)?.id || (state.users[0]?.id || 1)
  pinInput.value = ''
  roleError.value = ''
  pendingTab.value = null
  showRoleModal.value = true
}

function handleRoleSwitch() {
  roleError.value = ''
  const res = switchRole(selectedTargetUser.value, pinInput.value)
  if (res.success) {
    showRoleModal.value = false
    pinInput.value = ''
    showToast('បានប្តូរទៅកាន់គណនី «' + res.name + '» ជោគជ័យ!', 'success', 'ប្តូរ Role')
    if (pendingTab.value && canAccess(pendingTab.value)) {
      tab.value = pendingTab.value
      pendingTab.value = null
    } else if (!canAccess(tab.value)) {
      tab.value = 'dash'
    }
  } else {
    roleError.value = res.message
  }
}

async function handleLogout() {
  const ok = await askConfirm({
    title: 'ចាកចេញពីប្រព័ន្ធ (Logout)',
    message: 'តើអ្នកពិតជាចង់ចាកចេញពីគណនីបច្ចុប្បន្នមែនទេ?',
    confirmText: 'ចាកចេញ',
    cancelText: 'នៅបន្ត',
    type: 'warning'
  })
  if (ok) {
    logout()
    showToast('អ្នកបានចាកចេញពីប្រព័ន្ធដោយជោគជ័យ', 'info', 'Logout')
  }
}

function selectTab(t, adminOnly = false) {
  // If allowed by permissions and admin status:
  if (canAccess(t) && (!adminOnly || isAdmin.value)) {
    tab.value = t
    sideOpen.value = false
    return
  }

  // If locked: Prompt Admin PIN to easily unlock and proceed!
  pendingTab.value = t
  const adminUser = state.users.find(u => u.role === 'admin')
  selectedTargetUser.value = adminUser ? adminUser.id : (state.users[0]?.id || 1)
  pinInput.value = ''
  roleError.value = 'មុខងារ «' + getTabTitle(t) + '» សម្រាប់តែ Admin ឬទាមទារសិទ្ធិ។ សូមបញ្ចូលលេខ PIN Admin ដើម្បីចូលប្រើប្រាស់។'
  showRoleModal.value = true
  sideOpen.value = false
}

// Smart Google Sheets Sync Action (Auto Push local changes & Pull latest remote data)
async function handleQuickSync() {
  if (syncStatus.loading) return

  // 1. If there are unsaved local changes, push first
  if (syncStatus.hasPendingChanges) {
    showToast('កំពុងបញ្ជូនទិន្នន័យថ្មីទៅ Google Sheets...', 'info')
    await pushToGoogleSheets()
  }

  // 2. Pull latest data from Google Sheets to ensure all devices are synchronized
  showToast('កំពុងទាញទិន្នន័យចុងក្រោយពី Google Sheets...', 'info')
  const res = await fetchFromGoogleSheets(false)
  if (res.success) {
    showToast('ទិន្នន័យត្រូវបានធ្វើបច្ចុប្បន្នភាពទាន់សម័យជោគជ័យ!', 'success', 'Sync ជោគជ័យ')
  } else {
    showToast('បរាជ័យក្នុងការទាញទិន្នន័យ៖ ' + res.message, 'error', 'កំហុស Sync')
  }
}
</script>

<template>
  <!-- Full Screen Login if not authenticated -->
  <Login v-if="!authState.isLoggedIn" />

  <div v-else class="layout" :class="{ 'menu-open': sideOpen }">
    <!-- Mobile / Tablet Sticky Header -->
    <header class="mobile-header no-print">
      <button class="icon-btn burger" @click="sideOpen = !sideOpen" aria-label="Menu">
        <i :class="sideOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
      </button>

      <div class="brand">
        <span class="brand-icon">
          <svg viewBox="0 0 512 512" width="22" height="22" fill="currentColor">
            <path d="M318,256H194c-13,0-23,10-23,23v124c0,47,38,85,85,85s85-38,85-85V279C341,266,331,256,318,256z" fill="#38a169"/>
            <path d="M256,23C115,23,0,138,0,279c0,13,10,23,23,23h466c13,0,23-10,23-23C512,138,397,23,256,23z" fill="#2f7d4f"/>
          </svg>
        </span>
        <span class="brand-text">{{ state.settings.farmName || 'កសិដ្ឋានផ្សិត' }}</span>
      </div>

      <div class="header-right-actions">
        <!-- Google Sheets Cloud Sync Button -->
        <button 
          class="sheets-sync-btn" 
          :class="{ syncing: syncStatus.loading }"
          title="ចុចដើម្បីទាញទិន្នន័យថ្មី និងធ្វើសមកាលកម្ម (Sync & Pull Data)"
          @click="handleQuickSync"
        >
          <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': syncStatus.loading }"></i>
          <span class="sync-text-btn">{{ syncStatus.loading ? 'កំពុង Sync...' : 'Sync ទិន្នន័យ' }}</span>
        </button>

        <!-- Role Indicator Button -->
        <button class="role-pill-btn" :class="isAdmin ? 'role-admin' : 'role-user'" @click="openRoleModal">
          <i :class="isAdmin ? 'fa-solid fa-crown' : 'fa-solid fa-user'"></i>
          <span>{{ isAdmin ? 'Admin' : 'User' }}</span>
        </button>

        <!-- Logout Button -->
        <button class="logout-icon-btn" title="ចាកចេញ (Logout)" @click="handleLogout">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>

        <!-- Currency switcher -->
        <div class="header-cur">
          <button 
            :class="['cur-btn', { active: state.cur === '៛' }]" 
            @click="state.cur = '៛'"
          >៛</button>
          <button 
            :class="['cur-btn', { active: state.cur === '$' }]" 
            @click="state.cur = '$'"
          >$</button>
        </div>
      </div>
    </header>

    <!-- Sidebar / Drawer (Cleaned: Widgets moved to Settings) -->
    <aside class="side no-print" :class="{ open: sideOpen }">
      <div class="side-header">
        <div class="brand">
          <span class="brand-icon">
            <svg viewBox="0 0 512 512" width="26" height="26" fill="currentColor">
              <path d="M318,256H194c-13,0-23,10-23,23v124c0,47,38,85,85,85s85-38,85-85V279C341,266,331,256,318,256z" fill="#38a169"/>
              <path d="M256,23C115,23,0,138,0,279c0,13,10,23,23,23h466c13,0,23-10,23-23C512,138,397,23,256,23z" fill="#2f7d4f"/>
            </svg>
          </span>
          <h1 class="brand-text">{{ state.settings.farmName || 'កសិដ្ឋានផ្សិត' }}</h1>
        </div>
        <button class="icon-btn close-btn" @click="sideOpen = false" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <nav class="side-nav">
        <!-- Section: Operations -->
        <span class="nav-section-title">ប្រតិបត្តិការប្រចាំថ្ងៃ</span>
        <button 
          v-for="t in opTabs" 
          :key="t[0]" 
          :class="[{ on: tab === t[0] }, { 'locked-item': !canAccess(t[0]) }]" 
          @click="selectTab(t[0])"
        >
          <i :class="t[1]"></i>
          <span>{{ t[2] }}</span>
          <i v-if="!canAccess(t[0])" class="fa-solid fa-lock lock-indicator" title="ទាមទារសិទ្ធិ"></i>
        </button>

        <!-- Section: Management -->
        <span class="nav-section-title mt-3">ការគ្រប់គ្រង & Admin</span>
        <button 
          v-for="t in mgmtTabs" 
          :key="t[0]" 
          :class="[{ on: tab === t[0] }, { 'locked-item': (t[3] && !isAdmin) || !canAccess(t[0]) }]" 
          @click="selectTab(t[0], t[3])"
        >
          <i :class="t[1]"></i>
          <span>{{ t[2] }}</span>
          <i v-if="(t[3] && !isAdmin) || !canAccess(t[0])" class="fa-solid fa-lock lock-indicator" title="ទាមទារ Admin"></i>
        </button>
      </nav>

      <div class="side-footer">
        <button class="btn btn-outline btn-sm sidebar-logout-btn w-full mb-3" @click="handleLogout">
          <i class="fa-solid fa-right-from-bracket text-danger"></i>
          <span>ចាកចេញ (Logout)</span>
        </button>
        <div class="cur-box">
          <label><i class="fa-solid fa-coins"></i> រូបិយប័ណ្ណបង្ហាញ</label>
          <div class="cur-pills">
            <button 
              :class="['cur-pill', { on: state.cur === '៛' }]" 
              @click="state.cur = '៛'"
            >៛ រៀល</button>
            <button 
              :class="['cur-pill', { on: state.cur === '$' }]" 
              @click="state.cur = '$'"
            >$ ដុល្លារ</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Overlay backdrop for mobile drawer -->
    <div v-if="sideOpen" class="backdrop no-print" @click="sideOpen = false"></div>

    <!-- Main Content Area -->
    <main class="main">
            <!-- Guard if user does not have permission for the current tab -->
      <div v-if="!canAccess(tab)" class="card text-center py-5">
        <div class="icon-circle bg-amber-light text-amber mx-auto mb-3" style="width: 50px; height: 50px; font-size: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
          <i class="fa-solid fa-lock"></i>
        </div>
        <h3 class="mb-1">គណនីរបស់អ្នកមិនមានសិទ្ធិចូលប្រើប្រាស់មុខងារនេះទេ</h3>
        <p class="text-mu mb-4">មុខងារនេះត្រូវបានកំណត់កម្រិតដោយ Admin។ សូមទាក់ទងអ្នកគ្រប់គ្រង ឬប្តូរទៅកាន់គណនីដែលមានសិទ្ធិ។</p>
        <button class="btn btn-primary" @click="openRoleModal">
          <i class="fa-solid fa-right-left"></i> ប្តូរគណនី / Role
        </button>
      </div>


      <template v-else>
        <Dashboard v-if="tab === 'dash'" />
        <Reports v-else-if="tab === 'reports'" />
        <DataManager v-else-if="tab === 'data'" />
        <Settings v-else-if="tab === 'settings'" @open-role-modal="openRoleModal" />
        <WorkersPayroll v-else-if="tab === 'workers'" />
        <Inventory v-else-if="tab === 'inventory'" />
        <DataPanel v-else :key="tab" :t="tab" />
      </template>
    </main>

    <!-- Mobile Bottom Navigation Bar -->
    <nav class="bottom-nav no-print">
      <button :class="{ active: tab === 'dash' }" @click="selectTab('dash')">
        <i class="fa-solid fa-chart-pie"></i>
        <span>ផ្ទាំងគ្រប់គ្រង</span>
      </button>
      <button :class="{ active: tab === 'harvests' }" @click="selectTab('harvests')">
        <i class="fa-solid fa-basket-shopping"></i>
        <span>ផល</span>
      </button>
      <button :class="{ active: tab === 'incomes' }" @click="selectTab('incomes')">
        <i class="fa-solid fa-money-bill-trend-up"></i>
        <span>ចំណូល</span>
      </button>
      <button :class="{ active: tab === 'reports' }" @click="selectTab('reports')">
        <i class="fa-solid fa-chart-line"></i>
        <span>របាយការណ៍</span>
      </button>
      <button :class="{ active: sideOpen }" @click="sideOpen = !sideOpen">
        <i class="fa-solid fa-bars"></i>
        <span>ម៉ឺនុយ</span>
      </button>
    </nav>

    <!-- Role Switching Modal -->
    <div v-if="showRoleModal" class="modal-backdrop" @click.self="showRoleModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3><i class="fa-solid fa-user-shield text-emerald"></i> ប្តូរតួនាទី (Switch Role)</h3>
          <button class="icon-btn" @click="showRoleModal = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="modal-body">
                    <div class="user-switch-list-box mb-3">
            <label class="label-text mb-2 text-xs font-bold text-mu">ជ្រើសរើសគណនីដែលចង់ប្តូរទៅ៖</label>
            <div class="login-users-grid">
              <button 
                v-for="u in state.users.filter(x => x.status === 'active')" 
                :key="u.id" 
                type="button" 
                class="login-user-card" 
                :class="{ active: selectedTargetUser === u.id }"
                @click="selectedTargetUser = u.id; roleError = ''"
              >
                <div class="user-avatar-circle" :class="u.role === 'admin' ? 'bg-emerald-light text-emerald' : 'bg-blue-light text-blue'">
                  <i :class="u.role === 'admin' ? 'fa-solid fa-crown' : 'fa-solid fa-user'"></i>
                </div>
                <div class="user-meta">
                  <b class="user-name">{{ u.name }}</b>
                  <span class="user-role-text" :class="u.role === 'admin' ? 'text-emerald' : 'text-blue'">
                    {{ u.role === 'admin' ? '👑 Admin' : '👤 User (@' + u.username + ')' }}
                  </span>
                </div>
                <i v-if="selectedTargetUser === u.id" class="fa-solid fa-circle-check user-check-icon text-emerald"></i>
              </button>
            </div>
          </div>

          <!-- PIN input -->
          <div class="pin-entry-box mt-3">
            <label class="label-text">
              <i class="fa-solid fa-key"></i> បញ្ចូលលេខកូដសម្ងាត់ PIN
            </label>
            <input 
              type="password" 
              v-model="pinInput" 
              placeholder="បញ្ចូលលេខសម្ងាត់ PIN..." 
              class="form-control text-center font-bold text-lg mt-1" 
              autofocus 
              @keyup.enter="handleRoleSwitch"
            />
            <small class="text-mu block mt-1 text-center">Admin: <b>1234</b> | User: <b>0000</b> (ឬចុចប្តូរប្រសិនបើគ្មាន PIN)</small>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="showRoleModal = false">បោះបង់</button>
          <button class="btn btn-primary" @click="handleRoleSwitch">
            <i class="fa-solid fa-check"></i> បញ្ជាក់ការប្តូរ
          </button>
        </div>
      </div>
    </div>
  
    <!-- Global Toast Alerts Container -->
    <div class="toast-container" aria-live="polite">
      <transition-group name="toast">
        <div 
          v-for="t in toasts" 
          :key="t.id" 
          class="toast-card" 
          :class="'toast-' + t.type"
          @click="removeToast(t.id)"
        >
          <div class="toast-icon">
            <i v-if="t.type === 'success'" class="fa-solid fa-circle-check"></i>
            <i v-else-if="t.type === 'error'" class="fa-solid fa-circle-xmark"></i>
            <i v-else-if="t.type === 'warning'" class="fa-solid fa-triangle-exclamation"></i>
            <i v-else class="fa-solid fa-circle-info"></i>
          </div>
          <div class="toast-content">
            <b v-if="t.title" class="toast-title">{{ t.title }}</b>
            <span class="toast-message">{{ t.message }}</span>
          </div>
          <button class="toast-close" @click.stop="removeToast(t.id)">✕</button>
        </div>
      </transition-group>
    </div>

    <!-- Global Custom Confirm Dialog Modal -->
    <div v-if="confirmDialog.show" class="modal-backdrop confirm-backdrop" @click.self="handleConfirmResponse(false)">
      <div class="modal-card confirm-card">
        <div class="confirm-icon-box" :class="'confirm-' + confirmDialog.type">
          <i v-if="confirmDialog.type === 'danger'" class="fa-solid fa-triangle-exclamation"></i>
          <i v-else-if="confirmDialog.type === 'warning'" class="fa-solid fa-triangle-exclamation"></i>
          <i v-else class="fa-solid fa-circle-question"></i>
        </div>
        <h3 class="confirm-title">{{ confirmDialog.title }}</h3>
        <p class="confirm-message">{{ confirmDialog.message }}</p>
        <div class="confirm-actions">
          <button class="btn btn-outline" @click="handleConfirmResponse(false)">
            {{ confirmDialog.cancelText }}
          </button>
          <button 
            class="btn" 
            :class="confirmDialog.type === 'danger' ? 'btn-danger' : 'btn-primary'" 
            @click="handleConfirmResponse(true)"
          >
            {{ confirmDialog.confirmText }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
