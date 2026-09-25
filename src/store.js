import { reactive, computed, watch } from 'vue'

const KEY = 'mushroom-farm-v1'
export const STAGES = ['ត្រៀមសម្ភារៈ', 'ក្រៀលមេរោគ', 'ដាក់មេ', 'លូតលាស់មេ', 'ចេញផ្សិត', 'ប្រមូលផល', 'បញ្ចប់']
export const DEFAULT_TYPES = ['ផ្សិតចំបើង', 'ផ្សិតទឹកដោះគោ', 'ផ្សិតឆ្នាំង', 'ផ្សិតអយស្ទ័រ', 'ផ្សេងៗ']
export const DEFAULT_CATS = ['សម្ភារៈ', 'ស្ពរ/មេផ្សិត', 'ថង់/ក្រដាស', 'ភ្លើង/ទឹក', 'ប្រាក់ឈ្នួល', 'ដឹកជញ្ជូន', 'ផ្សេងៗ']

export const APP_FEATURES = [
  { key: 'dash', name: 'ផ្ទាំងគ្រប់គ្រង (Dashboard)', icon: 'fa-solid fa-chart-pie', desc: 'មើលស្ថិតិ ទិន្នផល និងសេចក្តីសង្ខេបកសិដ្ឋាន' },
  { key: 'batches', name: 'វគ្គផលិតកម្ម (Batches)', icon: 'fa-solid fa-seedling', desc: 'បង្កើត និងគ្រប់គ្រងដំណាក់កាលវគ្គផ្សិត' },
  { key: 'harvests', name: 'កំណត់ត្រាផល (Harvests)', icon: 'fa-solid fa-basket-shopping', desc: 'កត់ត្រាការប្រមូលផល និងគុណភាពក្រេដ' },
  { key: 'incomes', name: 'កំណត់ត្រាចំណូល (Incomes)', icon: 'fa-solid fa-money-bill-trend-up', desc: 'កត់ត្រាការលក់ដុំ និងលក់រាយ' },
  { key: 'expenses', name: 'កំណត់ត្រាចំណាយ (Expenses)', icon: 'fa-solid fa-receipt', desc: 'កត់ត្រាចំណាយប្រតិបត្តិការ' },
  { key: 'workers', name: 'កម្មករ & ប្រាក់ឈ្នួល (Workers & Payroll)', icon: 'fa-solid fa-users-gear', desc: 'គ្រប់គ្រងកម្មករ និងបើកប្រាក់ឈ្នួល' },
  { key: 'inventory', name: 'ស្តុកវត្ថុធាតុដើម (Inventory)', icon: 'fa-solid fa-boxes-stacked', desc: 'គ្រប់គ្រងស្តុក នាំចូល និងដកប្រើ' },
  { key: 'reports', name: 'របាយការណ៍ហិរញ្ញវត្ថុ (Reports)', icon: 'fa-solid fa-chart-line', desc: 'មើល និងបោះពុម្ពរបាយការណ៍លម្អិត' },
  { key: 'data', name: 'ទិន្នន័យ & Backup (Data & Cloud)', icon: 'fa-solid fa-database', desc: 'គ្រប់គ្រង Backup, Sync Google Sheets និង CSV' },
]

export const DEFAULT_USER_PERMS = {
  dash: true,
  batches: true,
  harvests: true,
  incomes: true,
  expenses: true,
  workers: true,
  inventory: true,
  reports: false,
  data: false,
}

export const DEFAULT_USERS = [
  {
    id: 1,
    name: 'អ្នកគ្រប់គ្រង (Admin)',
    username: 'admin',
    pin: '1234',
    role: 'admin',
    status: 'active',
    createdAt: '2026-01-01',
    permissions: { dash: true, batches: true, harvests: true, incomes: true, expenses: true, workers: true, inventory: true, reports: true, data: true, settings: true },
  },
  {
    id: 2,
    name: 'បុគ្គលិកកត់ត្រា (User)',
    username: 'staff',
    pin: '0000',
    role: 'user',
    status: 'active',
    createdAt: '2026-01-01',
    permissions: { ...DEFAULT_USER_PERMS },
  }
]

const defaultSettings = {
  farmName: 'កសិដ្ឋានផ្សិតធម្មជាតិ',
  owner: 'អ្នកគ្រប់គ្រងកសិដ្ឋាន',
  phone: '012 345 678',
  address: 'ខេត្តកណ្តាល, ប្រទេសកម្ពុជា',
  rate: 4100, // 1 USD = 4100 KHR
  adminPin: '1234', // default Admin PIN
  userPin: '', // optional User PIN (blank means no password)
  googleScriptUrl: 'https://script.google.com/macros/s/AKfycbw7WG2NvlzDF95GphvRGYCdCtB5a8CY8sYu_F88tHoFAH1uF-YBAGVTr8plb_-PSCOC/exec',
  autoSync: true,
  types: [...DEFAULT_TYPES],
  cats: [...DEFAULT_CATS],
}

const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) || {}
    const s = { ...defaultSettings, ...(raw.settings || {}) }
    if (!s.adminPin) s.adminPin = '1234'
    if (!s.googleScriptUrl) s.googleScriptUrl = 'https://script.google.com/macros/s/AKfycbw7WG2NvlzDF95GphvRGYCdCtB5a8CY8sYu_F88tHoFAH1uF-YBAGVTr8plb_-PSCOC/exec'
    if (s.autoSync === undefined) s.autoSync = true
    return {
      batches: raw.batches || [],
      harvests: raw.harvests || [],
      incomes: (raw.incomes || []).map(i => ({ ...i, saleType: i.saleType || 'លក់ដុំ' })),
      expenses: raw.expenses || [],
      workers: raw.workers || [],
      wages: raw.wages || [],
      materials: raw.materials || [],
      stockMovements: raw.stockMovements || [],
      users: (raw.users && Array.isArray(raw.users) && raw.users.length)
        ? raw.users.map(u => ({
            ...u,
            pin: u.pin !== undefined ? String(u.pin) : (u.role === 'admin' ? '1234' : '0000'),
            permissions: u.role === 'admin'
              ? { dash: true, batches: true, harvests: true, incomes: true, expenses: true, workers: true, inventory: true, reports: true, data: true, settings: true }
              : (u.permissions ? { ...DEFAULT_USER_PERMS, ...u.permissions } : { ...DEFAULT_USER_PERMS })
          }))
        : JSON.parse(JSON.stringify(DEFAULT_USERS)),
      cur: raw.cur || '៛',
      settings: s,
    }
  } catch {
    return { batches: [], harvests: [], incomes: [], expenses: [], workers: [], wages: [], materials: [], stockMovements: [], users: JSON.parse(JSON.stringify(DEFAULT_USERS)), cur: '៛', settings: { ...defaultSettings } }
  }
}

export const state = reactive(load())
watch(state, () => localStorage.setItem(KEY, JSON.stringify(state)), { deep: true })

// Realtime Database Auto-Sync Watcher to Google Sheets
let autoSyncTimer = null
watch(
  () => [
    state.batches,
    state.harvests,
    state.incomes,
    state.expenses,
    state.workers,
    state.wages,
    state.materials,
    state.stockMovements,
    state.users,
    state.settings
  ],
  () => {
    if (state.settings.autoSync !== false) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        syncStatus.hasPendingChanges = true
        return
      }
      syncStatus.hasPendingChanges = true
      if (autoSyncTimer) clearTimeout(autoSyncTimer)
      autoSyncTimer = setTimeout(() => {
        pushToGoogleSheets()
      }, 1000)
    }
  },
  { deep: true }
)


// =========================================================================
// Multi-User, Role Permissions & Authentication System
// =========================================================================
const AUTH_KEY = 'mushroom-farm-auth-v1'

const loadSavedAuth = () => {
  // Always clean up any legacy persistent localStorage auth
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_KEY)
    }
  } catch {}

  // Check sessionStorage (per-session/tab isolation)
  try {
    if (typeof sessionStorage !== 'undefined') {
      const saved = JSON.parse(sessionStorage.getItem(AUTH_KEY))
      if (saved && typeof saved === 'object' && saved.isLoggedIn === true && saved.userId) {
        if (saved.role === 'admin') {
          saved.permissions = { dash: true, batches: true, harvests: true, incomes: true, expenses: true, workers: true, inventory: true, reports: true, data: true, settings: true }
        } else if (!saved.permissions) {
          saved.permissions = { ...DEFAULT_USER_PERMS }
        }
        return saved
      }
    }
  } catch {}

  // By Default: MUST LOG IN (No auto-login on opening link/session)
  return {
    isLoggedIn: false,
    userId: null,
    role: 'user',
    name: '',
    username: '',
    permissions: { ...DEFAULT_USER_PERMS },
  }
}

export const authState = reactive(loadSavedAuth())

// Watcher to save active session to sessionStorage only
watch(authState, () => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (authState.isLoggedIn && authState.userId) {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(authState))
      } else {
        sessionStorage.removeItem(AUTH_KEY)
      }
    }
    // Guarantee localStorage NEVER holds permanent auto-login
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_KEY)
    }
  } catch {}
}, { deep: true })

// Optional 30-minute inactivity auto-lock for enhanced security
let inactivityTimer = null
const resetInactivityTimer = () => {
  if (inactivityTimer) clearTimeout(inactivityTimer)
  if (authState.isLoggedIn) {
    inactivityTimer = setTimeout(() => {
      logout()
    }, 30 * 60 * 1000) // 30 minutes
  }
}

if (typeof window !== 'undefined') {
  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer, { passive: true })
  })
}

export const currentUser = authState
export const isAdmin = computed(() => authState.isLoggedIn && authState.role === 'admin')
export const isUser = computed(() => authState.isLoggedIn && authState.role === 'user')

export function canAccess(featureKey) {
  if (!authState.isLoggedIn) return false
  if (authState.role === 'admin') return true
  if (authState.permissions && authState.permissions[featureKey] !== undefined) {
    return !!authState.permissions[featureKey]
  }
  return DEFAULT_USER_PERMS[featureKey] ?? (featureKey !== 'settings' && featureKey !== 'data')
}

export function login(identifier, pin = '') {
  const pinStr = String(pin !== undefined && pin !== null ? pin : '').trim()
  const idStr = String(identifier !== undefined && identifier !== null ? identifier : '').trim()
  const lower = idStr.toLowerCase()
  let matchedUser = null

  // 1. Match by username (case-insensitive)
  if (lower) {
    matchedUser = (state.users || []).find(u => u.username && String(u.username).trim().toLowerCase() === lower)
  }

  // 2. Match by user ID (type-safe string comparison)
  if (!matchedUser && idStr) {
    matchedUser = (state.users || []).find(u => String(u.id).trim() === idStr)
  }

  // 3. Fallback match for role keywords
  if (!matchedUser) {
    if (lower === 'admin') {
      matchedUser = (state.users || []).find(u => u.role === 'admin' && String(u.pin || '').trim() === pinStr)
      if (!matchedUser) matchedUser = (state.users || []).find(u => u.role === 'admin')
    } else if (lower === 'user' || lower === 'staff') {
      matchedUser = (state.users || []).find(u => u.role === 'user' && String(u.pin || '').trim() === pinStr)
      if (!matchedUser) matchedUser = (state.users || []).find(u => u.role === 'user')
    }
  }

  if (!matchedUser) {
    return { success: false, message: 'រកមិនឃើញឈ្មោះគណនី «' + idStr + '» នៅក្នុងប្រព័ន្ធទេ!' }
  }

  if (matchedUser.status === 'inactive') {
    return { success: false, message: 'គណនី «' + matchedUser.name + '» ត្រូវបានផ្អាកដំណើរការដោយ Admin!' }
  }

  // Validate PIN (string normalized)
  const expectedPin = String(matchedUser.pin !== undefined && matchedUser.pin !== null ? matchedUser.pin : '').trim()
  if (expectedPin && expectedPin !== pinStr) {
    // Fallback check against settings.adminPin for admin role
    if (matchedUser.role === 'admin' && state.settings && state.settings.adminPin && pinStr === String(state.settings.adminPin).trim()) {
      // Allow fallback
    } else {
      return { success: false, message: 'លេខកូដសម្ងាត់ (PIN) មិនត្រឹមត្រូវទេ!' }
    }
  }

  // Set session
  authState.isLoggedIn = true
  authState.userId = matchedUser.id
  authState.name = matchedUser.name
  authState.username = matchedUser.username
  authState.role = matchedUser.role
  authState.permissions = matchedUser.role === 'admin'
    ? { dash: true, batches: true, harvests: true, incomes: true, expenses: true, workers: true, inventory: true, reports: true, data: true, settings: true }
    : { ...DEFAULT_USER_PERMS, ...(matchedUser.permissions || {}) }

  return { success: true, name: authState.name, role: authState.role }
}

export function logout() {
  authState.isLoggedIn = false
  authState.userId = null
  authState.role = 'user'
  authState.name = ''
  authState.username = ''
  authState.permissions = { ...DEFAULT_USER_PERMS }
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(AUTH_KEY)
    if (typeof localStorage !== 'undefined') localStorage.removeItem(AUTH_KEY)
  } catch {}
}

export function switchRole(targetUserIdOrRole, pin = '') {
  return login(targetUserIdOrRole, pin)
}

export function verifyAdminPin(pin) {
  const pinStr = String(pin !== undefined && pin !== null ? pin : '').trim()
  if (!pinStr) return false

  // 1. Check settings adminPin
  if (state.settings && state.settings.adminPin && String(state.settings.adminPin).trim() === pinStr) {
    return true
  }

  // 2. Check current logged-in user if admin
  if (authState && authState.role === 'admin') {
    const current = (state.users || []).find(u => u.id === authState.userId)
    if (current && String(current.pin).trim() === pinStr) {
      return true
    }
  }

  // 3. Check any active admin in state.users
  const adminUsers = (state.users || []).filter(u => u.role === 'admin' && u.status === 'active')
  if (adminUsers.some(u => String(u.pin).trim() === pinStr)) {
    return true
  }

  // 4. Fallback default admin PIN
  if (pinStr === '1234') {
    return true
  }

  return false
}

// User CRUD Management functions
export function addUser(userData) {
  const newId = uid()
  const username = (userData.username || 'user' + newId).trim().toLowerCase()
  if (state.users.some(u => u.username && u.username.toLowerCase() === username)) {
    return { success: false, message: 'ឈ្មោះចូលប្រើ (Username) «' + username + '» នេះមានរួចហើយ! សូមជ្រើសរើសឈ្មោះផ្សេង។' }
  }

  const role = userData.role || 'user'
  const newUser = {
    id: newId,
    name: userData.name || 'បុគ្គលិកថ្មី',
    username,
    pin: userData.pin !== undefined ? String(userData.pin).trim() : '0000',
    role,
    status: userData.status || 'active',
    address: userData.address || '',
    createdAt: new Date().toISOString().slice(0, 10),
    permissions: role === 'admin'
      ? { dash: true, batches: true, harvests: true, incomes: true, expenses: true, workers: true, inventory: true, reports: true, data: true, settings: true }
      : { ...DEFAULT_USER_PERMS, ...(userData.permissions || {}) }
  }

  state.users.push(newUser)
  return { success: true, user: newUser }
}

export function updateUser(id, updated) {
  const idStr = String(id).trim()
  const idx = (state.users || []).findIndex(u => String(u.id).trim() === idStr)
  if (idx === -1) return { success: false, message: 'រកមិនឃើញគណនីនេះទេ!' }

  if (updated.username) {
    const newUsername = String(updated.username).trim().toLowerCase()
    const duplicate = state.users.some(u => String(u.id).trim() !== idStr && u.username && String(u.username).trim().toLowerCase() === newUsername)
    if (duplicate) {
      return { success: false, message: 'ឈ្មោះចូលប្រើ (Username) «' + newUsername + '» នេះមានរួចហើយ!' }
    }
    updated.username = newUsername
  }

  // Prevent disabling or deranking the last active admin
  if (state.users[idx].role === 'admin' && (updated.role === 'user' || updated.status === 'inactive')) {
    const activeAdmins = state.users.filter(u => u.role === 'admin' && u.status === 'active' && String(u.id).trim() !== idStr)
    if (activeAdmins.length === 0) {
      return { success: false, message: 'មិនអាចប្តូរ ឬផ្អាកគណនី Admin ចុងក្រោយគេបានទេ!' }
    }
  }

  const role = updated.role || state.users[idx].role
  const perms = role === 'admin'
    ? { dash: true, batches: true, harvests: true, incomes: true, expenses: true, workers: true, inventory: true, reports: true, data: true, settings: true }
    : { ...DEFAULT_USER_PERMS, ...(updated.permissions || state.users[idx].permissions || {}) }

  state.users[idx] = {
    ...state.users[idx],
    ...updated,
    id: state.users[idx].id, // preserve ID
    name: updated.name ? String(updated.name).trim() : state.users[idx].name,
    pin: updated.pin !== undefined ? String(updated.pin).trim() : state.users[idx].pin,
    permissions: perms,
  }

  // Realtime sync if current logged-in user is updated
  if (String(authState.userId).trim() === idStr) {
    authState.name = state.users[idx].name
    authState.username = state.users[idx].username
    authState.role = state.users[idx].role
    authState.permissions = state.users[idx].permissions
  }

  return { success: true, user: state.users[idx] }
}

export function deleteUser(id) {
  const idStr = String(id).trim()
  const user = (state.users || []).find(u => String(u.id).trim() === idStr)
  if (!user) return { success: false, message: 'រកមិនឃើញគណនីនេះទេ!' }

  if (user.role === 'admin') {
    const adminCount = state.users.filter(u => u.role === 'admin').length
    if (adminCount <= 1) {
      return { success: false, message: 'មិនអាចលុបគណនី Admin ចុងក្រោយគេបានទេ!' }
    }
  }

  if (String(authState.userId).trim() === idStr) {
    return { success: false, message: 'មិនអាចលុបគណនីដែលកំពុង Login ប្រើប្រាស់បច្ចុប្បន្នបានទេ!' }
  }

  state.users = state.users.filter(u => String(u.id).trim() !== idStr)
  return { success: true }
}



// Google Sheets Database Sync Service
export const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw7WG2NvlzDF95GphvRGYCdCtB5a8CY8sYu_F88tHoFAH1uF-YBAGVTr8plb_-PSCOC/exec'

export const syncStatus = reactive({
  loading: false,
  saving: false,
  lastSynced: (typeof localStorage !== 'undefined' ? localStorage.getItem('mushroom-last-synced') : null) || null,
  error: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  hasPendingChanges: false,
  autoSyncing: true,
})

const cleanDate = (d) => {
  if (!d) return ''
  const s = String(d)
  return s.length >= 10 ? s.slice(0, 10) : s
}

export async function pushToGoogleSheets() {
  const url = state.settings.googleScriptUrl || 'https://script.google.com/macros/s/AKfycbw7WG2NvlzDF95GphvRGYCdCtB5a8CY8sYu_F88tHoFAH1uF-YBAGVTr8plb_-PSCOC/exec'
  syncStatus.loading = true
  syncStatus.error = null
  try {
    const payload = {
      batches: state.batches,
      harvests: state.harvests,
      incomes: state.incomes,
      expenses: state.expenses,
      workers: state.workers,
      wages: state.wages,
      materials: state.materials,
      stockMovements: state.stockMovements,
      users: state.users.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        pin: u.pin !== undefined ? String(u.pin) : '',
        status: u.status || 'active',
        address: u.address || '',
        permissions: typeof u.permissions === 'object' ? JSON.stringify(u.permissions) : (u.permissions || '')
      })),
      settings: [{
        farm: state.settings.farm || '',
        owner: state.settings.owner || '',
        phone: state.settings.phone || '',
        address: state.settings.address || '',
        rate: state.settings.rate || 4100,
        cur: state.cur || '៛',
        types: JSON.stringify(state.settings.types || []),
        cats: JSON.stringify(state.settings.cats || [])
      }],
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (json.status === 'success') {
      const nowStr = new Date().toLocaleTimeString('km-KH')
      syncStatus.lastSynced = nowStr
      syncStatus.hasPendingChanges = false
      syncStatus.error = null
      localStorage.setItem('mushroom-last-synced', nowStr)
      return { success: true }
    } else {
      throw new Error(json.message || 'បរាជ័យក្នុងការ Sync ទៅ Google Sheets')
    }
  } catch (err) {
    syncStatus.error = err.message
    return { success: false, message: err.message }
  } finally {
    syncStatus.loading = false
  }
}

let isInitializingSync = false
export async function initGoogleSheetsSync() {
  if (isInitializingSync) return
  isInitializingSync = true

  // Setup online/offline listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      syncStatus.isOnline = true
      if (syncStatus.hasPendingChanges) {
        pushToGoogleSheets()
      }
    })
    window.addEventListener('offline', () => {
      syncStatus.isOnline = false
    })
  }

  // Auto fetch from Google Sheets on app startup
  const url = state.settings.googleScriptUrl || DEFAULT_SCRIPT_URL
  if (url && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      await fetchFromGoogleSheets()
    } catch (e) {
      console.warn('Initial Google Sheets fetch failed, using local storage cache:', e)
    }
  }
}

export async function fetchFromGoogleSheets() {
  const url = state.settings.googleScriptUrl || 'https://script.google.com/macros/s/AKfycbw7WG2NvlzDF95GphvRGYCdCtB5a8CY8sYu_F88tHoFAH1uF-YBAGVTr8plb_-PSCOC/exec'
  syncStatus.loading = true
  syncStatus.error = null
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data) {
      if (Array.isArray(data.batches)) {
        state.batches = data.batches.map(b => ({
          ...b,
          id: +b.id || b.id,
          bags: +b.bags || 0,
          date: cleanDate(b.date),
        }))
      }
      if (Array.isArray(data.harvests)) {
        state.harvests = data.harvests.map(h => ({
          ...h,
          id: +h.id || h.id,
          batch: +h.batch || h.batch,
          kg: +h.kg || 0,
          bad: +h.bad || 0,
          date: cleanDate(h.date),
        }))
      }
      if (Array.isArray(data.incomes)) {
        state.incomes = data.incomes.map(i => ({
          ...i,
          id: +i.id || i.id,
          batch: +i.batch || i.batch,
          saleType: i.saleType || 'លក់ដុំ',
          kg: +i.kg || 0,
          price: +i.price || 0,
          date: cleanDate(i.date),
        }))
      }
      if (Array.isArray(data.expenses)) {
        state.expenses = data.expenses.map(e => ({
          ...e,
          id: +e.id || e.id,
          batch: e.batch ? (+e.batch || e.batch) : '',
          amt: +e.amt || 0,
          date: cleanDate(e.date),
        }))
      }
      if (Array.isArray(data.workers)) {
        state.workers = data.workers.map(w => ({
          ...w,
          id: +w.id || w.id,
          rate: +w.rate || 0,
        }))
      }
      if (Array.isArray(data.wages)) {
        state.wages = data.wages.map(w => ({
          ...w,
          id: +w.id || w.id,
          workerId: +w.workerId || w.workerId,
          batchId: w.batchId ? (+w.batchId || w.batchId) : '',
          workQty: +w.workQty || 0,
          rate: +w.rate || 0,
          baseAmt: +w.baseAmt || 0,
          bonus: +w.bonus || 0,
          deduction: +w.deduction || 0,
          totalPaid: +w.totalPaid || 0,
          date: cleanDate(w.date),
        }))
      }
      if (Array.isArray(data.materials)) {
        state.materials = data.materials.map(m => ({
          ...m,
          id: +m.id || m.id,
          qty: +m.qty || 0,
          minQty: +m.minQty || 0,
          price: +m.price || 0,
        }))
      }
      if (Array.isArray(data.stockMovements)) {
        state.stockMovements = data.stockMovements.map(s => ({
          ...s,
          id: +s.id || s.id,
          materialId: +s.materialId || s.materialId,
          batchId: s.batchId ? (+s.batchId || s.batchId) : '',
          qty: +s.qty || 0,
          cost: +s.cost || 0,
          date: cleanDate(s.date),
        }))
      }
      if (Array.isArray(data.users) && data.users.length) {
        state.users = data.users.map(u => {
          let perms = { ...DEFAULT_USER_PERMS }
          if (u.permissions) {
            if (typeof u.permissions === 'string') {
              try { perms = JSON.parse(u.permissions) } catch (e) { perms = { ...DEFAULT_USER_PERMS } }
            } else if (typeof u.permissions === 'object') {
              perms = { ...u.permissions }
            }
          }
          if (u.role === 'admin') {
            perms = { dash: true, batches: true, harvests: true, incomes: true, expenses: true, workers: true, inventory: true, reports: true, data: true, settings: true }
          }
          return {
            id: +u.id || u.id,
            name: u.name || '',
            username: u.username || '',
            role: u.role || 'user',
            pin: u.pin !== undefined ? String(u.pin).trim() : (u.role === 'admin' ? '1234' : '0000'),
            status: u.status || 'active',
            address: u.address || '',
            permissions: perms
          }
        })
      }
      if (Array.isArray(data.settings) && data.settings.length) {
        const s = data.settings[0]
        if (s.farm) state.settings.farm = s.farm
        if (s.owner) state.settings.owner = s.owner
        if (s.phone) state.settings.phone = s.phone
        if (s.address) state.settings.address = s.address
        if (s.rate) state.settings.rate = +s.rate || 4100
        if (s.cur) state.cur = s.cur
        if (s.types) {
          try {
            const types = typeof s.types === 'string' ? JSON.parse(s.types) : s.types
            if (Array.isArray(types) && types.length) state.settings.types = types
          } catch {}
        }
        if (s.cats) {
          try {
            const cats = typeof s.cats === 'string' ? JSON.parse(s.cats) : s.cats
            if (Array.isArray(cats) && cats.length) state.settings.cats = cats
          } catch {}
        }
      }
      const nowStr = new Date().toLocaleTimeString('km-KH')
      syncStatus.lastSynced = nowStr
      localStorage.setItem('mushroom-last-synced', nowStr)
      return { success: true }
    }
    throw new Error('ទិន្នន័យដែលទទួលបានពី Google Sheets មិនត្រឹមត្រូវ')
  } catch (err) {
    syncStatus.error = err.message
    return { success: false, message: err.message }
  } finally {
    syncStatus.loading = false
  }
}

export const FIELDS = {
  get batches() {
    return [
      ['code', 'លេខកូដវគ្គ', 'text', null, 'fa-solid fa-barcode'],
      ['type', 'ប្រភេទផ្សិត', 'sel', state.settings.types, 'fa-solid fa-cubes-stacked'],
      ['bags', 'ចំនួនថង់', 'num', null, 'fa-solid fa-boxes-stacked'],
      ['date', 'ថ្ងៃចាប់ផ្តើម', 'date', null, 'fa-solid fa-calendar-day'],
      ['stage', 'ដំណាក់កាល', 'sel', STAGES, 'fa-solid fa-bars-progress'],
    ]
  },
  get harvests() {
    return [
      ['batch', 'វគ្គ', 'batch', null, 'fa-solid fa-layer-group'],
      ['date', 'ថ្ងៃ', 'date', null, 'fa-solid fa-calendar-day'],
      ['kg', 'ទម្ងន់ (គ.ក)', 'num', null, 'fa-solid fa-weight-hanging'],
      ['grade', 'ក្រេដ', 'sel', ['A', 'B', 'C'], 'fa-solid fa-star'],
      ['bad', 'ថង់ខូច', 'num', null, 'fa-solid fa-triangle-exclamation'],
    ]
  },
  get incomes() {
    return [
      ['batch', 'វគ្គ', 'batch', null, 'fa-solid fa-layer-group'],
      ['date', 'ថ្ងៃ', 'date', null, 'fa-solid fa-calendar-day'],
      ['saleType', 'ប្រភេទលក់', 'sel', ['លក់ដុំ', 'លក់រាយ'], 'fa-solid fa-store'],
      ['cust', 'អតិថិជន', 'text', null, 'fa-solid fa-user'],
      ['kg', 'លក់ (គ.ក)', 'num', null, 'fa-solid fa-weight-scale'],
      ['price', 'តម្លៃ/គ.ក', 'num', null, 'fa-solid fa-tag'],
    ]
  },
  get expenses() {
    return [
      ['batch', 'វគ្គ', 'batchg', null, 'fa-solid fa-layer-group'],
      ['date', 'ថ្ងៃ', 'date', null, 'fa-solid fa-calendar-day'],
      ['cat', 'ប្រភេទ', 'sel', state.settings.cats, 'fa-solid fa-tags'],
      ['amt', 'ទឹកប្រាក់', 'num', null, 'fa-solid fa-money-bill-1-wave'],
      ['note', 'កំណត់សម្គាល់', 'text', null, 'fa-solid fa-note-sticky'],
    ]
  },
}

export const uid = () => Date.now() + Math.floor(Math.random() * 100000)
export const sum = (a, k) => a.reduce((t, x) => t + (+x[k] || 0), 0)
export const fmt = (n) => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US')
export const money = (n) => (state.cur === '$' ? '$' + fmt(n) : fmt(n) + ' ៛')
export const bname = (id) => state.batches.find((b) => b.id === id)?.code ?? 'ទូទៅ'
export const sale = (x) => (+x.kg || 0) * (+x.price || 0)

export const stats = computed(() => {
  const rows = state.batches.map((b) => {
    const kg = sum(state.harvests.filter((x) => x.batch === b.id), 'kg')
    const bad = sum(state.harvests.filter((x) => x.batch === b.id), 'bad')
    const inc = state.incomes.filter((x) => x.batch === b.id).reduce((t, x) => t + sale(x), 0)
    const exp = sum(state.expenses.filter((x) => x.batch === b.id), 'amt')
    return { b, kg, bad, inc, exp, profit: inc - exp, badPct: b.bags ? (bad / b.bags) * 100 : 0, perBag: b.bags ? kg / b.bags : 0, perBagKham: b.bags ? (kg / b.bags) * 10 : 0, cost: kg ? exp / kg : null }
  })
  const income = state.incomes.reduce((t, x) => t + sale(x), 0)
  const expense = sum(state.expenses, 'amt')
  return { rows, income, expense, profit: income - expense, kg: sum(state.harvests, 'kg'), general: sum(state.expenses.filter((x) => !x.batch), 'amt') }
})

export const monthly = computed(() => {
  const out = []
  const d = new Date(); d.setDate(1)
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const key = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0')
    out.push({
      key,
      inc: state.incomes.filter((x) => x.date?.startsWith(key)).reduce((t, x) => t + sale(x), 0),
      exp: sum(state.expenses.filter((x) => x.date?.startsWith(key)), 'amt'),
    })
  }
  return out
})

export const stageCounts = computed(() => STAGES.map((s) => ({ s, n: state.batches.filter((b) => b.stage === s).length })))

export function removeBatch(id) {
  state.batches = state.batches.filter((b) => b.id !== id)
  state.harvests = state.harvests.filter((x) => x.batch !== id)
  state.incomes = state.incomes.filter((x) => x.batch !== id)
  state.expenses.forEach((x) => { if (x.batch === id) x.batch = '' })
}

export function exportBackupJSON() {
  const payload = {
    appName: 'Mushroom Farm Dashboard',
    version: '1.2.0',
    exportedAt: new Date().toISOString(),
    data: {
      batches: state.batches,
      harvests: state.harvests,
      incomes: state.incomes,
      expenses: state.expenses,
      workers: state.workers,
      wages: state.wages,
      cur: state.cur,
      settings: state.settings,
    }
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const dateStr = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `mushroom-farm-backup-${dateStr}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importBackupJSON(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr)
    const d = parsed.data || parsed
    if (!d.batches && !d.harvests && !d.incomes && !d.expenses) {
      throw new Error('ទម្រង់ឯកសារមិនត្រឹមត្រូវ')
    }
    state.batches = Array.isArray(d.batches) ? d.batches : []
    state.harvests = Array.isArray(d.harvests) ? d.harvests : []
    state.incomes = Array.isArray(d.incomes) ? d.incomes : []
    state.expenses = Array.isArray(d.expenses) ? d.expenses : []
    state.workers = Array.isArray(d.workers) ? d.workers : []
    state.wages = Array.isArray(d.wages) ? d.wages : []
    state.materials = Array.isArray(d.materials) ? d.materials : []
    state.stockMovements = Array.isArray(d.stockMovements) ? d.stockMovements : []
    if (Array.isArray(d.users) && d.users.length) state.users = d.users
    if (d.cur) state.cur = d.cur
    if (d.settings) state.settings = { ...defaultSettings, ...d.settings }
    return { success: true }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

export function loadSampleData() {
  const now = new Date()
  const dStr = (offsetDays) => {
    const d = new Date(now.getTime() - offsetDays * 86400000)
    return d.toISOString().slice(0, 10)
  }

  const b1 = uid()
  const b2 = b1 + 1
  const b3 = b1 + 2

  state.batches = [
    { id: b1, code: 'B-2026-01', type: 'ផ្សិតចំបើង', bags: 1200, date: dStr(45), stage: 'ប្រមូលផល' },
    { id: b2, code: 'B-2026-02', type: 'ផ្សិតអយស្ទ័រ', bags: 850, date: dStr(25), stage: 'ចេញផ្សិត' },
    { id: b3, code: 'B-2026-03', type: 'ផ្សិតទឹកដោះគោ', bags: 1500, date: dStr(10), stage: 'លូតលាស់មេ' },
  ]

  state.harvests = [
    { id: uid() + 10, batch: b1, date: dStr(14), kg: 45, grade: 'A', bad: 5 },
    { id: uid() + 11, batch: b1, date: dStr(12), kg: 60, grade: 'A', bad: 8 },
    { id: uid() + 12, batch: b1, date: dStr(9), kg: 52, grade: 'B', bad: 10 },
    { id: uid() + 13, batch: b1, date: dStr(6), kg: 70, grade: 'A', bad: 6 },
    { id: uid() + 14, batch: b1, date: dStr(3), kg: 40, grade: 'B', bad: 4 },
    { id: uid() + 15, batch: b2, date: dStr(2), kg: 35, grade: 'A', bad: 2 },
    { id: uid() + 16, batch: b2, date: dStr(1), kg: 48, grade: 'A', bad: 3 },
  ]

  state.incomes = [
    { id: uid() + 20, batch: b1, date: dStr(14), saleType: 'លក់ដុំ', cust: 'ផ្សារដើមគ', kg: 45, price: 9000 },
    { id: uid() + 21, batch: b1, date: dStr(12), saleType: 'លក់ដុំ', cust: 'ភោជនីយដ្ឋានមេគង្គ', kg: 60, price: 9500 },
    { id: uid() + 22, batch: b1, date: dStr(9), saleType: 'លក់ដុំ', cust: 'ផ្សារច្បារអំពៅ', kg: 50, price: 8500 },
    { id: uid() + 23, batch: b1, date: dStr(6), saleType: 'លក់ដុំ', cust: 'ផ្សារដើមគ', kg: 70, price: 9000 },
    { id: uid() + 24, batch: b1, date: dStr(3), saleType: 'លក់រាយ', cust: 'ម៉ាតទំនើប ភ្នំពេញ', kg: 40, price: 10000 },
    { id: uid() + 25, batch: b2, date: dStr(2), saleType: 'លក់រាយ', cust: 'អតិថិជនផ្ទាល់', kg: 35, price: 10500 },
    { id: uid() + 26, batch: b2, date: dStr(1), saleType: 'លក់ដុំ', cust: 'ផ្សារច្បារអំពៅ', kg: 45, price: 9000 },
  ]


  state.workers = [
    { id: 101, name: 'សុខ ចាន់ថា', phone: '012 889 123', role: 'អ្នកច្រកថង់ & ចំហុយ', wageType: 'daily', baseRate: 35000, startDate: dStr(60), status: 'active', notes: 'កម្មករជំនាញច្រកថង់ និងលាយកន្ទក់កំបោរ' },
    { id: 102, name: 'វ៉ាន់ ធារី', phone: '098 776 543', role: 'អ្នកបេះផ្សិត & វេចខ្ចប់', wageType: 'piece', baseRate: 500, startDate: dStr(50), status: 'active', notes: 'គិតកម្រៃ 500៛ ក្នុង ១ គីឡូក្រាម' },
    { id: 103, name: 'មាស សម្បត្តិ', phone: '087 334 556', role: 'មេការគ្រប់គ្រងទូទៅ', wageType: 'monthly', baseRate: 1000000, startDate: dStr(90), status: 'active', notes: 'គ្រប់គ្រងបច្ចេកទេស កម្តៅ និងសំណើមក្នុងរោង' },
    { id: 104, name: 'កែវ វិបុល', phone: '070 112 233', role: 'ដឹកជញ្ជូន & ទីផ្សារ', wageType: 'daily', baseRate: 40000, startDate: dStr(30), status: 'active', notes: 'ដឹកជញ្ជូនផ្សិតទៅផ្សារដើមគរ និងផ្សារច្បារអំពៅ' },
  ]

  state.wages = [
    { id: uid() + 50, workerId: 101, workerName: 'សុខ ចាន់ថា', date: dStr(28), batchId: b1, workType: 'ច្រកថង់ផ្សិត', workQty: 6, unit: 'ថ្ងៃ', rate: 35000, baseAmt: 210000, bonus: 15000, deduction: 0, totalPaid: 225000, paymentMethod: 'សាច់ប្រាក់ (Cash)', syncToExpense: true, note: 'ច្រកថង់បាន 1200 ថង់ វគ្គ B-2026-01' },
    { id: uid() + 51, workerId: 102, workerName: 'វ៉ាន់ ធារី', date: dStr(14), batchId: b1, workType: 'បេះផ្សិត & វេចខ្ចប់', workQty: 150, unit: 'គ.ក', rate: 500, baseAmt: 75000, bonus: 10000, deduction: 0, totalPaid: 85000, paymentMethod: 'ABA Pay', syncToExpense: true, note: 'បេះផ្សិតវគ្គ B-2026-01 ក្រេដ A' },
    { id: uid() + 52, workerId: 103, workerName: 'មាស សម្បត្តិ', date: dStr(5), batchId: '', workType: 'បើកប្រាក់ខែប្រចាំខែ', workQty: 1, unit: 'ខែ', rate: 1000000, baseAmt: 1000000, bonus: 50000, deduction: 0, totalPaid: 1050000, paymentMethod: 'ABA Pay', syncToExpense: true, note: 'ប្រាក់ខែមេការគ្រប់គ្រងរោងផ្សិត' },
    { id: uid() + 53, workerId: 104, workerName: 'កែវ វិបុល', date: dStr(3), batchId: b1, workType: 'ដឹកជញ្ជូនផ្សិត', workQty: 4, unit: 'ជើង', rate: 25000, baseAmt: 100000, bonus: 0, deduction: 0, totalPaid: 100000, paymentMethod: 'សាច់ប្រាក់ (Cash)', syncToExpense: true, note: 'ដឹកទៅផ្សារដើមគ ៤ ជើង' },
    { id: uid() + 54, workerId: 101, workerName: 'សុខ ចាន់ថា', date: dStr(2), batchId: b2, workType: 'ចំហុយ និងដាក់មេ', workQty: 3, unit: 'ថ្ងៃ', rate: 35000, baseAmt: 105000, bonus: 10000, deduction: 0, totalPaid: 115000, paymentMethod: 'សាច់ប្រាក់ (Cash)', syncToExpense: true, note: 'រៀបចំចំហុយវគ្គ B-2026-02' },
  ]

  state.expenses = [
    { id: uid() + 30, batch: b1, date: dStr(45), cat: 'ស្ពរ/មេផ្សិត', amt: 250000, note: 'ទិញមេផ្សិតចំបើងគុណភាពខ្ពស់' },
    { id: uid() + 31, batch: b1, date: dStr(44), cat: 'ថង់/ក្រដាស', amt: 120000, note: 'ថង់ដាំផ្សិតទំហំស្តង់ដារ' },
    { id: uid() + 32, batch: b1, date: dStr(35), cat: 'សម្ភារៈ', amt: 85000, note: 'កំបោរ និងកន្ទក់' },
    { id: uid() + 33, batch: b2, date: dStr(25), cat: 'ស្ពរ/មេផ្សិត', amt: 180000, note: 'មេផ្សិតអយស្ទ័រ' },
    { id: uid() + 34, batch: b2, date: dStr(24), cat: 'ថង់/ក្រដាស', amt: 95000, note: 'ថង់ដាំផ្សិតអយស្ទ័រ' },
        { id: uid() + 35, batch: '', date: dStr(15), cat: 'ភ្លើង/ទឹក', amt: 150000, note: 'ថ្លៃភ្លើងទឹកប្រចាំខែ' },
    { id: uid() + 36, batch: '', date: dStr(5), cat: 'ប្រាក់ឈ្នួល', amt: 300000, note: 'ឈ្នួលច្រកថង់ និងថែទាំ' },
  ]

  const mat1 = uid() + 60
  const mat2 = mat1 + 1
  const mat3 = mat1 + 2
  const mat4 = mat1 + 3

  state.materials = [
    { id: mat1, name: 'មេផ្សិតចំបើង F1', cat: 'មេផ្សិត/ស្ពរ', currentStock: 25, unit: 'ដប', minStock: 10, unitCost: 3500, supplier: 'មជ្ឈមណ្ឌលស្រាវជ្រាវកសិកម្ម', notes: 'រក្សាទុកកន្លែងត្រជាក់' },
    { id: mat2, name: 'ថង់ដាំផ្សិត PP 18x35cm', cat: 'ថង់ដាំ', currentStock: 80, unit: 'គ.ក', minStock: 20, unitCost: 8000, supplier: 'ហាងសម្ភារៈកសិកម្ម ភ្នំពេញ', notes: 'ថង់គុណភាពខ្ពស់ ធន់កម្ដៅ' },
    { id: mat3, name: 'កន្ទក់ម៉ដ្ឋ (Rice Bran)', cat: 'ជីវជាតិ/ជីបំប៉ន', currentStock: 150, unit: 'គ.ក', minStock: 50, unitCost: 1200, supplier: 'រោងម៉ាស៊ីនកិនស្រូវ បាត់ដំបង', notes: 'សារធាតុចិញ្ចឹមមេផ្សិត' },
    { id: mat4, name: 'កំបោរស (Lime Powder)', cat: 'សម្ភារៈជំនួយ', currentStock: 8, unit: 'ការុង', minStock: 10, unitCost: 15000, supplier: 'ដេប៉ូសំណង់', notes: 'កែសម្រួលកម្រិត pH (ស្តុកជិតអស់!)' },
  ]

  state.stockMovements = [
    { id: uid() + 70, type: 'in', materialId: mat1, materialName: 'មេផ្សិតចំបើង F1', date: dStr(45), qty: 50, unit: 'ដប', unitCost: 3500, totalCost: 175000, batchId: b1, supplier: 'មជ្ឈមណ្ឌលស្រាវជ្រាវកសិកម្ម', note: 'ទិញសម្រាប់វគ្គ B-2026-01', expenseId: null },
    { id: uid() + 71, type: 'out', materialId: mat1, materialName: 'មេផ្សិតចំបើង F1', date: dStr(40), qty: 25, unit: 'ដប', unitCost: 3500, totalCost: 87500, batchId: b1, supplier: '', note: 'ដាក់មេក្នុងរោងវគ្គ B-2026-01', expenseId: null },
    { id: uid() + 72, type: 'in', materialId: mat2, materialName: 'ថង់ដាំផ្សិត PP 18x35cm', date: dStr(30), qty: 100, unit: 'គ.ក', unitCost: 8000, totalCost: 800000, batchId: '', supplier: 'ហាងសម្ភារៈកសិកម្ម ភ្នំពេញ', note: 'ទិញស្តុកទុកប្រើ', expenseId: null },
    { id: uid() + 73, type: 'out', materialId: mat2, materialName: 'ថង់ដាំផ្សិត PP 18x35cm', date: dStr(25), qty: 20, unit: 'គ.ក', unitCost: 8000, totalCost: 160000, batchId: b2, supplier: '', note: 'ច្រកថង់សម្រាប់វគ្គ B-2026-02', expenseId: null },
  ]

    try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.error(e)
  }
}

export function resetAllData() {
  state.batches = []
  state.harvests = []
  state.incomes = []
  state.expenses = []
  state.workers = []
  state.wages = []
  state.materials = []
  state.stockMovements = []
  state.users = JSON.parse(JSON.stringify(DEFAULT_USERS))
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.error(e)
  }
}

export function exportToCSV(filename, headers, rows) {
  const escapeCell = (v) => {
    if (v === null || v === undefined) return '""'
    const s = String(v).replace(/"/g, '""')
    return `"${s}"`
  }
  const csvContent = '\uFEFF' + [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(','))
  ].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// =========================================================================
// Global Toast & Confirm Dialog System
// =========================================================================
export const toasts = reactive([])
export const confirmDialog = reactive({
  show: false,
  title: 'បញ្ជាក់សកម្មភាព',
  message: '',
  confirmText: 'បញ្ជាក់',
  cancelText: 'បោះបង់',
  type: 'danger',
  resolve: null,
})

export function showToast(message, type = 'success', title = '') {
  const id = Date.now() + Math.random()
  toasts.push({ id, type, message, title })
  setTimeout(() => {
    removeToast(id)
  }, 4000)
}

export function removeToast(id) {
  const idx = toasts.findIndex(t => t.id === id)
  if (idx !== -1) toasts.splice(idx, 1)
}

export function askConfirm({ title = 'បញ្ជាក់សកម្មភាព', message, confirmText = 'យល់ព្រម', cancelText = 'បោះបង់', type = 'danger' }) {
  return new Promise((resolve) => {
    confirmDialog.title = title
    confirmDialog.message = message
    confirmDialog.confirmText = confirmText
    confirmDialog.cancelText = cancelText
    confirmDialog.type = type
    confirmDialog.resolve = resolve
    confirmDialog.show = true
  })
}

export function handleConfirmResponse(val) {
  if (confirmDialog.resolve) {
    confirmDialog.resolve(val)
  }
  confirmDialog.show = false
}

// =========================================================================
// Worker & Wage Management Functions
// =========================================================================
export const WORKER_ROLES = [
  'អ្នកច្រកថង់ & ចំហុយ',
  'អ្នកបេះផ្សិត & វេចខ្ចប់',
  'អ្នកដាក់មេ & មើលថែរោង',
  'ដឹកជញ្ជូន & ទីផ្សារ',
  'មេការគ្រប់គ្រងទូទៅ',
  'កម្មករទូទៅ'
]

export const WAGE_TYPES = [
  { id: 'daily', name: 'ប្រចាំថ្ងៃ (Daily)' },
  { id: 'monthly', name: 'ប្រចាំខែ (Monthly)' },
  { id: 'piece', name: 'តាមបរិមាណ (Piece-rate / គ.ក / ថង់)' }
]
export function wName(workerId) {
  const w = state.workers.find(x => x.id === workerId)
  return w ? w.name : 'កម្មករទូទៅ'
}

export function addWorker(worker) {
  const newW = {
    id: uid(),
    name: worker.name || 'កម្មករថ្មី',
    phone: worker.phone || '',
    role: worker.role || 'កម្មករទូទៅ',
    wageType: worker.wageType || 'daily',
    baseRate: +worker.baseRate || 0,
    startDate: worker.startDate || new Date().toISOString().slice(0, 10),
    status: worker.status || 'active',
    notes: worker.notes || '',
  }
  state.workers.unshift(newW)
  return newW
}

export function updateWorker(id, updated) {
  const idx = state.workers.findIndex(w => w.id === id)
  if (idx !== -1) {
    state.workers[idx] = { ...state.workers[idx], ...updated, id }
    state.wages.forEach(wg => {
      if (wg.workerId === id) wg.workerName = updated.name || wg.workerName
    })
    return true
  }
  return false
}

export function deleteWorker(id) {
  state.workers = state.workers.filter(w => w.id !== id)
}

export function addWage(wage, autoExpense = true) {
  const worker = state.workers.find(w => w.id === wage.workerId)
  const workerName = worker ? worker.name : (wage.workerName || 'កម្មករ')
  const newWage = {
    id: uid(),
    workerId: wage.workerId,
    workerName,
    date: wage.date || new Date().toISOString().slice(0, 10),
    batchId: wage.batchId ? (+wage.batchId || wage.batchId) : '',
    workType: wage.workType || 'ប្រាក់ឈ្នួលទូទៅ',
    workQty: +wage.workQty || 1,
    unit: wage.unit || 'ថ្ងៃ',
    rate: +wage.rate || 0,
    baseAmt: +wage.baseAmt || (+wage.workQty * +wage.rate),
    bonus: +wage.bonus || 0,
    deduction: +wage.deduction || 0,
    totalPaid: +wage.totalPaid || 0,
    paymentMethod: wage.paymentMethod || 'សាច់ប្រាក់ (Cash)',
    syncToExpense: !!autoExpense,
    expenseId: null,
    note: wage.note || '',
  }

  if (autoExpense && newWage.totalPaid > 0) {
    const expId = uid() + 1
    newWage.expenseId = expId
    state.expenses.unshift({
      id: expId,
      batch: newWage.batchId || '',
      date: newWage.date,
      cat: 'ប្រាក់ឈ្នួល',
      amt: newWage.totalPaid,
      note: 'បើកប្រាក់ឈ្នួល៖ ' + workerName + ' (' + newWage.workType + ' ' + newWage.workQty + ' ' + newWage.unit + ')',
      wageId: newWage.id
    })
  }

  state.wages.unshift(newWage)
  return newWage
}

export function updateWage(id, updated, autoExpense = true) {
  const idx = state.wages.findIndex(w => w.id === id)
  if (idx !== -1) {
    const prev = state.wages[idx]
    const worker = state.workers.find(w => w.id === updated.workerId)
    const workerName = worker ? worker.name : (updated.workerName || prev.workerName)
    const newWage = { ...prev, ...updated, id, workerName }
    state.wages[idx] = newWage

    if (newWage.expenseId) {
      const expIdx = state.expenses.findIndex(e => e.id === newWage.expenseId)
      if (expIdx !== -1) {
        state.expenses[expIdx].amt = newWage.totalPaid
        state.expenses[expIdx].date = newWage.date
        state.expenses[expIdx].batch = newWage.batchId || ''
        state.expenses[expIdx].note = 'បើកប្រាក់ឈ្នួល៖ ' + workerName + ' (' + newWage.workType + ')'
      }
    } else if (autoExpense && newWage.totalPaid > 0) {
      const expId = uid() + 1
      newWage.expenseId = expId
      state.expenses.unshift({
        id: expId,
        batch: newWage.batchId || '',
        date: newWage.date,
        cat: 'ប្រាក់ឈ្នួល',
        amt: newWage.totalPaid,
        note: 'បើកប្រាក់ឈ្នួល៖ ' + workerName + ' (' + newWage.workType + ')',
        wageId: newWage.id
      })
    }
    return true
  }
  return false
}

export function deleteWage(id) {
  const wage = state.wages.find(w => w.id === id)
  if (wage && wage.expenseId) {
    state.expenses = state.expenses.filter(e => e.id !== wage.expenseId)
  }
  state.wages = state.wages.filter(w => w.id !== id)
}



// Ensure state incomes have saleType
if (state.incomes && state.incomes.length) {
  state.incomes.forEach(i => {
    if (!i.saleType) i.saleType = 'លក់ដុំ'
  })
}


// =========================================================================
// Inventory & Raw Materials Management Functions
// =========================================================================
export const MATERIAL_CATS = [
  'មេផ្សិត/ស្ពរ',
  'ថង់ដាំ',
  'ស្រទាប់ដាំ/កាកសំណល់',
  'ជីវជាតិ/ជីបំប៉ន',
  'សម្ភារៈជំនួយ',
  'ឥន្ធនៈ/ហ្គាស/អុស',
  'ផ្សេងៗ'
]

export const MATERIAL_UNITS = ['គ.ក', 'ដប', 'ការុង', 'កញ្ចប់', 'ដុំ', 'ម៉ែត្រគូប', 'លីត្រ']

export function matName(id) {
  const m = (state.materials || []).find(x => x.id === id)
  return m ? m.name : 'វត្ថុធាតុដើម'
}

export function addMaterial(mat) {
  const newMat = {
    id: uid(),
    name: mat.name || 'វត្ថុធាតុដើមថ្មី',
    cat: mat.cat || MATERIAL_CATS[0],
    currentStock: +mat.currentStock || 0,
    unit: mat.unit || 'គ.ក',
    minStock: +mat.minStock || 10,
    unitCost: +mat.unitCost || 0,
    supplier: mat.supplier || '',
    notes: mat.notes || '',
  }
  if (!state.materials) state.materials = []
  state.materials.unshift(newMat)
  return newMat
}

export function updateMaterial(id, updated) {
  const idx = (state.materials || []).findIndex(m => m.id === id)
  if (idx !== -1) {
    state.materials[idx] = { ...state.materials[idx], ...updated, id }
    // Update cached name in movements
    if (state.stockMovements) {
      state.stockMovements.forEach(sm => {
        if (sm.materialId === id) sm.materialName = updated.name || sm.materialName
      })
    }
    return true
  }
  return false
}

export function deleteMaterial(id) {
  state.materials = (state.materials || []).filter(m => m.id !== id)
}

export function recordStockMovement(mov, autoExpense = true) {
  const mat = (state.materials || []).find(m => m.id === mov.materialId)
  if (!mat) return null

  const qty = +mov.qty || 0
  const unitCost = +mov.unitCost || mat.unitCost || 0
  const totalCost = +mov.totalCost || (qty * unitCost)

  const newMov = {
    id: uid(),
    type: mov.type || 'in', // 'in' (ទិញចូល) or 'out' (ដកប្រើប្រាស់)
    materialId: mat.id,
    materialName: mat.name,
    date: mov.date || new Date().toISOString().slice(0, 10),
    qty,
    unit: mat.unit,
    unitCost,
    totalCost,
    batchId: mov.batchId ? (+mov.batchId || mov.batchId) : '',
    supplier: mov.supplier || (mov.type === 'in' ? mat.supplier : ''),
    note: mov.note || '',
    expenseId: null
  }

  // Update material currentStock
  if (newMov.type === 'in') {
    mat.currentStock = (+mat.currentStock || 0) + qty
    mat.unitCost = unitCost // update average/latest cost

    // If autoExpense is true, record in Expenses
    if (autoExpense && totalCost > 0) {
      const expId = uid() + 1
      newMov.expenseId = expId
      state.expenses.unshift({
        id: expId,
        batch: newMov.batchId || '',
        date: newMov.date,
        cat: mat.cat.includes('មេផ្សិត') ? 'ស្ពរ/មេផ្សិត' : mat.cat.includes('ថង់') ? 'ថង់/ក្រដាស' : 'សម្ភារៈ',
        amt: totalCost,
        note: 'ទិញ ' + mat.name + ' (' + qty + ' ' + mat.unit + ') ចូលស្តុក',
        stockMovementId: newMov.id
      })
    }
  } else {
    mat.currentStock = Math.max(0, (+mat.currentStock || 0) - qty)
  }

  if (!state.stockMovements) state.stockMovements = []
  state.stockMovements.unshift(newMov)
  return newMov
}

export function deleteStockMovement(id) {
  const mov = (state.stockMovements || []).find(sm => sm.id === id)
  if (mov) {
    const mat = (state.materials || []).find(m => m.id === mov.materialId)
    if (mat) {
      // Revert stock quantity
      if (mov.type === 'in') {
        mat.currentStock = Math.max(0, (+mat.currentStock || 0) - mov.qty)
      } else {
        mat.currentStock = (+mat.currentStock || 0) + mov.qty
      }
    }
    // Delete linked expense if exists
    if (mov.expenseId) {
      state.expenses = state.expenses.filter(e => e.id !== mov.expenseId)
    }
    state.stockMovements = state.stockMovements.filter(sm => sm.id !== id)
  }
}


