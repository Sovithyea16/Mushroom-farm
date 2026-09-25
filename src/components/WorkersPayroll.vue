<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import {
  state,
  money,
  fmt,
  bname,
  wName,
  WORKER_ROLES,
  WAGE_TYPES,
  addWorker,
  updateWorker,
  deleteWorker,
  addWage,
  updateWage,
  deleteWage,
  exportToCSV,
  showToast,
  askConfirm,
  isAdmin,
  addAttendance,
  updateAttendance,
  deleteAttendance
} from '../store'

// Current active sub-tab view: 'analytics' | 'wages' | 'workers'
const view = ref('attendances')

// Filters for Wage Records
const searchWage = ref('')
const filterWorker = ref('')
const filterMonth = ref('')

// Filters for Workers List
const searchWorker = ref('')
const filterRole = ref('')
const filterStatus = ref('')

// Modals
const showWorkerModal = ref(false)
const isEditingWorker = ref(false)
const workerForm = ref({
  id: null,
  name: '',
  phone: '',
  role: WORKER_ROLES ? WORKER_ROLES[0] : 'អ្នកច្រកថង់ & ចំហុយ',
  wageType: 'daily',
  baseRate: 35000,
  startDate: new Date().toISOString().slice(0, 10),
  status: 'active',
  notes: '',
})

const showWageModal = ref(false)
const isEditingWage = ref(false)
const wageForm = ref({
  id: null,
  workerId: '',
  date: new Date().toISOString().slice(0, 10),
  batchId: '',
  workType: 'ច្រកថង់ផ្សិត',
  workQty: 1,
  unit: 'ថ្ងៃ',
  rate: 35000,
  bonus: 0,
  deduction: 0,
  paymentMethod: 'សាច់ប្រាក់ (Cash)',
  syncToExpense: true,
  note: '',
})

// Payslip & Worker History Modal
const showHistoryModal = ref(false)
const selectedWorkerForHistory = ref(null)
const showPayslipModal = ref(false)
const selectedWageForPayslip = ref(null)

// =========================================================================
// Computed Analytics & Metrics (សូមវិភាគ)
// =========================================================================
const activeWorkersCount = computed(() => state.workers.filter(w => w.status === 'active').length)
const totalWorkersCount = computed(() => state.workers.length)

const totalWagesPaid = computed(() => {
  return state.wages.reduce((sum, w) => sum + (+w.totalPaid || 0), 0)
})

const thisMonthKey = new Date().toISOString().slice(0, 7)
const thisMonthWagesPaid = computed(() => {
  return state.wages
    .filter(w => w.date && w.date.startsWith(thisMonthKey))
    .reduce((sum, w) => sum + (+w.totalPaid || 0), 0)
})

const totalRevenue = computed(() => {
  return state.incomes.reduce((sum, i) => sum + ((+i.kg || 0) * (+i.price || 0)), 0)
})

// Labor cost to Revenue Ratio (%)
const laborCostRatio = computed(() => {
  if (!totalRevenue.value || totalRevenue.value === 0) return 0
  return Math.round((totalWagesPaid.value / totalRevenue.value) * 1000) / 10
})

const avgWagePerWorker = computed(() => {
  if (totalWorkersCount.value === 0) return 0
  return Math.round(totalWagesPaid.value / totalWorkersCount.value)
})

// Monthly Labor Expenses (Last 6 Months) for SVG Chart
const monthlyLaborTrend = computed(() => {
  const result = []
  const d = new Date()
  d.setDate(1)
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const key = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0')
    const monthWages = state.wages.filter(w => w.date && w.date.startsWith(key))
    const total = monthWages.reduce((sum, w) => sum + (+w.totalPaid || 0), 0)
    result.push({
      key,
      label: String(m.getMonth() + 1).padStart(2, '0') + '/' + String(m.getFullYear()).slice(2),
      shortMonth: 'ខែ ' + (m.getMonth() + 1),
      total,
      count: monthWages.length
    })
  }
  return result
})

const maxMonthlyLabor = computed(() => {
  const max = Math.max(...monthlyLaborTrend.value.map(m => m.total), 1)
  return max
})

function chartBarHeight(amt) {
  if (!amt || amt <= 0) return 0
  const max = maxMonthlyLabor.value || 1
  return Math.max(Math.round((amt / max) * 110), 6)
}

// Breakdown by Worker Role
const roleBreakdown = computed(() => {
  const map = {}
  if (WORKER_ROLES) {
    WORKER_ROLES.forEach(r => { map[r] = 0 })
  }
  state.wages.forEach(wg => {
    const worker = state.workers.find(w => w.id === wg.workerId)
    const r = worker ? worker.role : 'ផ្សេងៗ'
    map[r] = (map[r] || 0) + (+wg.totalPaid || 0)
  })

  const total = totalWagesPaid.value || 1
  return Object.keys(map)
    .map(role => ({
      role,
      amount: map[role],
      pct: Math.round((map[role] / total) * 1000) / 10
    }))
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
})

// Breakdown by Wage Type
const wageTypeBreakdown = computed(() => {
  const map = { daily: 0, monthly: 0, piece: 0 }
  state.wages.forEach(wg => {
    const worker = state.workers.find(w => w.id === wg.workerId)
    const type = worker ? worker.wageType : 'daily'
    if (map[type] !== undefined) {
      map[type] += (+wg.totalPaid || 0)
    }
  })
  const total = totalWagesPaid.value || 1
  return [
    { id: 'daily', name: 'ប្រចាំថ្ងៃ (Daily)', amount: map.daily, pct: Math.round((map.daily / total) * 100) },
    { id: 'monthly', name: 'ប្រចាំខែ (Monthly)', amount: map.monthly, pct: Math.round((map.monthly / total) * 100) },
    { id: 'piece', name: 'តាមបរិមាណ (Piece-rate)', amount: map.piece, pct: Math.round((map.piece / total) * 100) },
  ]
})

// Top Earners / Worker Summary table
const workerSummaryList = computed(() => {
  return state.workers.map(w => {
    const workerWages = state.wages.filter(wg => wg.workerId === w.id)
    const totalPaid = workerWages.reduce((sum, wg) => sum + (+wg.totalPaid || 0), 0)
    const paymentsCount = workerWages.length
    const lastPayment = [...workerWages].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    return {
      worker: w,
      totalPaid,
      paymentsCount,
      lastPaymentDate: lastPayment ? lastPayment.date : 'មិនទាន់មាន',
    }
  }).sort((a, b) => b.totalPaid - a.totalPaid)
})

// =========================================================================
// Filtered Lists
// =========================================================================
const filteredWages = computed(() => {
  return state.wages.filter(w => {
    if (searchWage.value) {
      const q = searchWage.value.toLowerCase()
      const matchName = (w.workerName || '').toLowerCase().includes(q)
      const matchWork = (w.workType || '').toLowerCase().includes(q)
      const matchNote = (w.note || '').toLowerCase().includes(q)
      if (!matchName && !matchWork && !matchNote) return false
    }
    if (filterWorker.value && w.workerId !== +filterWorker.value) return false
    if (filterMonth.value && (!w.date || !w.date.startsWith(filterMonth.value))) return false
    return true
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
})

const filteredWorkers = computed(() => {
  return state.workers.filter(w => {
    if (searchWorker.value) {
      const q = searchWorker.value.toLowerCase()
      const matchName = (w.name || '').toLowerCase().includes(q)
      const matchPhone = (w.phone || '').includes(q)
      if (!matchName && !matchPhone) return false
    }
    if (filterRole.value && w.role !== filterRole.value) return false
    if (filterStatus.value && w.status !== filterStatus.value) return false
    return true
  })
})

// =========================================================================
// Actions: Worker CRUD
// =========================================================================
function openAddWorkerModal() {
  isEditingWorker.value = false
  workerForm.value = {
    id: null,
    name: '',
    phone: '',
    role: WORKER_ROLES[0],
    wageType: 'daily',
    baseRate: 35000,
    startDate: new Date().toISOString().slice(0, 10),
    status: 'active',
    notes: '',
  }
  showWorkerModal.value = true
}

function openEditWorkerModal(worker) {
  isEditingWorker.value = true
  workerForm.value = { ...worker }
  showWorkerModal.value = true
}

function handleSaveWorker() {
  if (!workerForm.value.name.trim()) {
    showToast('សូមបញ្ចូលឈ្មោះកម្មករ!', 'error', 'ទិន្នន័យមិនគ្រប់')
    return
  }
  if (isEditingWorker.value) {
    updateWorker(workerForm.value.id, workerForm.value)
    showToast('កែប្រែព័ត៌មាន «' + workerForm.value.name + '» ជោគជ័យ!', 'success')
  } else {
    addWorker(workerForm.value)
    showToast('បានបន្ថែមកម្មករ «' + workerForm.value.name + '» ដោយជោគជ័យ!', 'success')
  }
  showWorkerModal.value = false
}

async function handleDeleteWorker(worker) {
  const ok = await askConfirm({
    title: 'លុបកម្មករចេញពីបញ្ជី',
    message: 'តើអ្នកពិតជាចង់លុបកម្មករឈ្មោះ «' + worker.name + '» មែនទេ? កំណត់ត្រាប្រាក់ឈ្នួលកន្លងមកនឹងនៅតែរក្សាទុក។',
    confirmText: 'លុបកម្មករ',
    type: 'danger'
  })
  if (ok) {
    deleteWorker(worker.id)
    showToast('បានលុបកម្មករ «' + worker.name + '» រួចរាល់', 'info')
  }
}

// =========================================================================
// Actions: Wage CRUD
// =========================================================================

// ==== Attendance Logic ====
const attendanceDate = ref(new Date().toISOString().slice(0, 10))
const activeWorkersList = computed(() => state.workers.filter(w => w.status === 'active'))

const dailyAttendances = ref({})

watch([attendanceDate, activeWorkersList], ([newDate, workers]) => {
  dailyAttendances.value = {}
  workers.forEach(w => {
    const existing = (state.attendances || []).find(a => a.workerId === w.id && a.date === newDate)
    if (existing) {
      dailyAttendances.value[w.id] = { ...existing }
    } else {
      dailyAttendances.value[w.id] = { workerId: w.id, date: newDate, status: '', note: '', wageId: null }
    }
  })
}, { immediate: true })

function saveAttendance(workerId) {
  const att = dailyAttendances.value[workerId]
  if (!att) return
  if (!att.status) return 
  
  const existing = (state.attendances || []).find(a => a.id === att.id || (a.workerId === workerId && a.date === attendanceDate.value))
  if (existing) {
    if (existing.wageId) {
      showToast('វត្តមាននេះត្រូវបានបើកប្រាក់ឈ្នួលរួចហើយ មិនអាចកែប្រែបានទេ!', 'warning')
      dailyAttendances.value[workerId] = { ...existing }
      return
    }
    updateAttendance(existing.id, { status: att.status, note: att.note })
    att.id = existing.id
  } else {
    addAttendance({ ...att })
    const created = state.attendances[0]
    att.id = created.id
  }
}

// Auto-fill logic
watch(() => wageForm.value.workerId, (wid) => {
  if (wid && !isEditingWage.value) {
    const worker = state.workers.find(w => w.id === wid)
    if (worker) {
      wageForm.value.rate = worker.baseRate || 0
      
      const unpaid = (state.attendances || []).filter(a => a.workerId === wid && !a.wageId)
      let count = 0
      unpaid.forEach(a => {
        if (a.status === 'វត្តមាន') count += 1
        if (a.status === 'កន្លះថ្ងៃ') count += 0.5
      })
      
      wageForm.value.workQty = count
      if (count > 0) {
        wageForm.value.note = `ទូទាត់សម្រាប់វត្តមាន ${count} ថ្ងៃ`
      } else {
        wageForm.value.note = ''
      }
    }
  }
})

// Custom Save Wage
async function handleSaveWageAuto() {
  if (!wageForm.value.workerId) {
    showToast('សូមជ្រើសរើសកម្មករ!', 'error')
    return
  }
  if (!wageForm.value.rate || wageForm.value.rate <= 0) {
    showToast('សូមបញ្ចូលតម្លៃពលកម្ម (អត្រាប្រាក់ឈ្នួល)!', 'error')
    return
  }

  const baseAmt = (+wageForm.value.workQty) * (+wageForm.value.rate)
  const bonus = +wageForm.value.bonus || 0
  const deduction = +wageForm.value.deduction || 0
  const totalPaid = baseAmt + bonus - deduction

  const payload = {
    ...wageForm.value,
    workerName: bname(wageForm.value.workerId, 'workers'),
    baseAmt,
    totalPaid
  }

  if (isEditingWage.value) {
    updateWage(payload.id, payload)
    showToast('កែប្រែប្រាក់ឈ្នួលរួចរាល់', 'success')
  } else {
    addWage(payload)
    const newWage = state.wages[0]
    
    const unpaid = (state.attendances || []).filter(a => a.workerId === payload.workerId && !a.wageId)
    unpaid.forEach(a => {
      updateAttendance(a.id, { wageId: newWage.id })
    })
    
    showToast(`បើកប្រាក់ឈ្នួលជោគជ័យ។ បានទូទាត់វត្តមាន ${unpaid.length} ថ្ងៃ។`, 'success')
  }
  showWageModal.value = false
}

function openAddWageModal(presetWorker = null) {
  isEditingWage.value = false
  const defaultWorker = presetWorker || state.workers[0]
  const defaultWorkerId = defaultWorker ? defaultWorker.id : ''
  const defaultRate = defaultWorker ? defaultWorker.baseRate : 35000
  const defaultUnit = defaultWorker && defaultWorker.wageType === 'monthly' ? 'ខែ' : (defaultWorker && defaultWorker.wageType === 'piece' ? 'គ.ក' : 'ថ្ងៃ')

  wageForm.value = {
    id: null,
    workerId: defaultWorkerId,
    date: new Date().toISOString().slice(0, 10),
    batchId: state.batches.length ? state.batches[0].id : '',
    workType: defaultWorker ? defaultWorker.role : 'ច្រកថង់ផ្សិត',
    workQty: 1,
    unit: defaultUnit,
    rate: defaultRate,
    bonus: 0,
    deduction: 0,
    paymentMethod: 'សាច់ប្រាក់ (Cash)',
    syncToExpense: true,
    note: '',
  }
  calculateWageTotal()
  showWageModal.value = true
}

function onWorkerSelectedChange() {
  const worker = state.workers.find(w => w.id === wageForm.value.workerId)
  if (worker) {
    wageForm.value.rate = worker.baseRate || 0
    wageForm.value.workType = worker.role || 'ច្រកថង់ផ្សិត'
    if (worker.wageType === 'monthly') wageForm.value.unit = 'ខែ'
    else if (worker.wageType === 'piece') wageForm.value.unit = 'គ.ក'
    else wageForm.value.unit = 'ថ្ងៃ'
  }
  calculateWageTotal()
}

function calculateWageTotal() {
  const base = (+wageForm.value.workQty || 0) * (+wageForm.value.rate || 0)
  wageForm.value.baseAmt = base
  const total = base + (+wageForm.value.bonus || 0) - (+wageForm.value.deduction || 0)
  wageForm.value.totalPaid = total >= 0 ? total : 0
}

function openEditWageModal(wg) {
  isEditingWage.value = true
  wageForm.value = { ...wg }
  calculateWageTotal()
  showWageModal.value = true
}

function handleSaveWage() {
  if (!wageForm.value.workerId) {
    showToast('សូមជ្រើសរើសកម្មករ!', 'error', 'ទិន្នន័យមិនគ្រប់')
    return
  }
  calculateWageTotal()
  if (isEditingWage.value) {
    updateWage(wageForm.value.id, wageForm.value, wageForm.value.syncToExpense)
    showToast('បានកែប្រែកំណត់ត្រាប្រាក់ឈ្នួលដោយជោគជ័យ!', 'success')
  } else {
    addWage(wageForm.value, wageForm.value.syncToExpense)
    showToast('បានកត់ត្រាការបើកប្រាក់ឈ្នួលដោយជោគជ័យ!', 'success')
  }
  showWageModal.value = false
}

async function handleDeleteWage(wg) {
  const ok = await askConfirm({
    title: 'លុបកំណត់ត្រាប្រាក់ឈ្នួល',
    message: 'តើអ្នកពិតជាចង់លុបការបើកប្រាក់ឈ្នួលចំនួន ' + money(wg.totalPaid) + ' ទៅកាន់ «' + wg.workerName + '» មែនទេ?',
    confirmText: 'លុបកំណត់ត្រា',
    type: 'danger'
  })
  if (ok) {
    deleteWage(wg.id)
    showToast('បានលុបកំណត់ត្រាប្រាក់ឈ្នួលរួចរាល់', 'info')
  }
}

// =========================================================================
// History & Payslip Actions
// =========================================================================
function openWorkerHistory(worker) {
  selectedWorkerForHistory.value = worker
  showHistoryModal.value = true
}

const workerHistoryWages = computed(() => {
  if (!selectedWorkerForHistory.value) return []
  return state.wages
    .filter(wg => wg.workerId === selectedWorkerForHistory.value.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const workerHistoryTotalPaid = computed(() => {
  return workerHistoryWages.value.reduce((sum, wg) => sum + (+wg.totalPaid || 0), 0)
})

function openPayslip(wage) {
  selectedWageForPayslip.value = wage
  showPayslipModal.value = true
}

function printCurrentPayslip() {
  window.print()
}

// CSV Export for Payroll
function exportPayrollCSV() {
  const headers = ['កាលបរិច្ឆេទ', 'ឈ្មោះកម្មករ', 'តួនាទី', 'ការងារ', 'វគ្គផលិតកម្ម', 'បរិមាណ', 'ឯកតា', 'តម្លៃឯកតា', 'ប្រាក់ឈ្នួលដើម', 'ប្រាក់បន្ថែម/OT', 'កាត់ប្រាក់', 'សរុបទូទាត់', 'វិធីទូទាត់', 'កំណត់សម្គាល់']
  const rows = filteredWages.value.map(w => {
    const worker = state.workers.find(wk => wk.id === w.workerId)
    return [
      w.date,
      w.workerName,
      worker ? worker.role : '',
      w.workType,
      bname(w.batchId),
      w.workQty,
      w.unit,
      w.rate,
      w.baseAmt,
      w.bonus,
      w.deduction,
      w.totalPaid,
      w.paymentMethod,
      w.note
    ]
  })
  exportToCSV('mushroom-farm-payroll-' + new Date().toISOString().slice(0, 10), headers, rows)
  showToast('បាន Export បញ្ជីប្រាក់ឈ្នួលជា CSV រួចរាល់!', 'success')
}
</script>

<template>
  <div class="workers-payroll-page">
    <!-- Header Section -->
    <div class="card card-payroll-header mb-4">
      <div class="header-main-row">
        <div class="header-titles">
          <div class="title-with-badge">
            <h2>
              <i class="fa-solid fa-users-gear text-emerald"></i>
              កត់ត្រាកម្មករ & ប្រាក់ឈ្នួល (Workers & Payroll)
            </h2>
            <span class="badge-role-count">
              <i class="fa-solid fa-user-check"></i> {{ activeWorkersCount }} សកម្ម
            </span>
          </div>
          <p class="subtitle">
            គ្រប់គ្រងបញ្ជីកម្មករ កត់ត្រាការបើកប្រាក់ឈ្នួល និងវិភាគថ្លៃដើមពលកម្មប្រចាំកសិដ្ឋាន
          </p>
        </div>

        <div class="header-actions-group no-print">
          <button class="btn btn-primary" @click="openAddWageModal()">
            <i class="fa-solid fa-hand-holding-dollar"></i>
            <span>កត់ត្រាប្រាក់ឈ្នួល</span>
          </button>
          <button class="btn btn-outline" @click="openAddWorkerModal()">
            <i class="fa-solid fa-user-plus"></i>
            <span>បន្ថែមកម្មករ</span>
          </button>
          <button class="btn btn-outline" title="ទាញយកជា Excel/CSV" @click="exportPayrollCSV">
            <i class="fa-solid fa-file-csv text-emerald"></i>
            <span>CSV</span>
          </button>
        </div>
      </div>

      <!-- Navigation Sub-Tabs -->
      <div class="sub-nav-tabs mt-3 no-print">
        <button 
          :class="['sub-tab-btn', { active: view === 'attendances' }]" 
          @click="view = 'attendances'"
        >
          <i class="fa-solid fa-calendar-check"></i>
          <span>វត្តមានកម្មករ</span>
        </button>
        <button 
          :class="['sub-tab-btn', { active: view === 'analytics' }]" 
          @click="view = 'analytics'"
        >
          <i class="fa-solid fa-chart-pie"></i>
          <span>វិភាគថ្លៃពលកម្ម & Dashboard</span>
        </button>
        <button 
          :class="['sub-tab-btn', { active: view === 'wages' }]" 
          @click="view = 'wages'"
        >
          <i class="fa-solid fa-receipt"></i>
          <span>កំណត់ត្រាប្រាក់ឈ្នួល ({{ state.wages.length }})</span>
        </button>
        <button 
          :class="['sub-tab-btn', { active: view === 'workers' }]" 
          @click="view = 'workers'"
        >
          <i class="fa-solid fa-users"></i>
          <span>បញ្ជីឈ្មោះកម្មករ ({{ state.workers.length }})</span>
        </button>
      </div>
    </div>

    <!-- ===================================================================== -->

    <!-- ===================================================================== -->
    <!-- VIEW 4: ATTENDANCES -->
    <!-- ===================================================================== -->
        <div v-if="view === 'attendances'" class="attendances-view card mb-4">
      <div class="card-header flex-header">
        <h3><i class="fa-solid fa-calendar-check"></i> កត់ត្រាវត្តមានប្រចាំថ្ងៃ</h3>
        <div class="header-filters">
          <input type="date" v-model="attendanceDate" class="form-control" style="width: 150px;" />
        </div>
      </div>
      <div class="card-body" style="padding: 12px;">
        <div class="scroll-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>ឈ្មោះកម្មករ</th>
                <th>តួនាទី</th>
                <th>ស្ថានភាពវត្តមាន</th>
                <th>កំណត់សម្គាល់</th>
                <th style="width: 100px; text-align: center;">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in activeWorkersList" :key="w.id">
                <td>
                  <strong style="font-size: 14px;">{{ w.name }}</strong>
                  <div class="text-muted" style="font-size: 0.8rem">{{ w.phone || 'គ្មានលេខ' }}</div>
                </td>
                <td><span class="badge" style="background: var(--bg-hover);">{{ w.role }}</span></td>
                <td>
                  <div class="status-radios" v-if="dailyAttendances[w.id]">
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="វត្តមាន" v-model="dailyAttendances[w.id].status" @change="saveAttendance(w.id)" />
                      <span class="att-badge att-success">វត្តមាន (1)</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="កន្លះថ្ងៃ" v-model="dailyAttendances[w.id].status" @change="saveAttendance(w.id)" />
                      <span class="att-badge att-warning">កន្លះថ្ងៃ (0.5)</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="អវត្តមាន" v-model="dailyAttendances[w.id].status" @change="saveAttendance(w.id)" />
                      <span class="att-badge att-danger">អវត្តមាន (0)</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="ច្បាប់" v-model="dailyAttendances[w.id].status" @change="saveAttendance(w.id)" />
                      <span class="att-badge att-secondary">ច្បាប់ (0)</span>
                    </label>
                  </div>
                </td>
                <td>
                  <input type="text" v-if="dailyAttendances[w.id]" v-model="dailyAttendances[w.id].note" @blur="saveAttendance(w.id)" class="form-control" placeholder="មូលហេតុ..." style="width: 140px; min-height: 36px; font-size: 13px;" />
                </td>
                <td style="text-align: center;">
                  <span v-if="dailyAttendances[w.id] && dailyAttendances[w.id].wageId" class="att-badge att-secondary" style="font-size: 11px;">បានទូទាត់រួច</span>
                  <span v-else-if="dailyAttendances[w.id] && dailyAttendances[w.id].id" class="text-emerald" style="font-size: 13px;"><i class="fa-solid fa-check-circle"></i> រក្សាទុក</span>
                </td>
              </tr>
              <tr v-if="!activeWorkersList.length">
                <td colspan="5" class="text-center text-muted py-4">មិនមានកម្មករសកម្មទេ</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <!-- VIEW 1: ANALYTICS & DASHBOARD (សូមវិភាគ) -->
    <!-- ===================================================================== -->
    <div v-if="view === 'analytics'" class="analytics-view">
      <!-- 4 Top KPI Cards -->
      <div class="kpis mb-4">
        <!-- KPI 1: Active Workers -->
        <div class="kpi">
          <div class="kpi-icon-wrap" style="background: rgba(47, 125, 79, 0.15); color: var(--ac);">
            <i class="fa-solid fa-users"></i>
          </div>
          <div class="kpi-body">
            <div class="kpi-lbl">កម្មករសកម្ម / សរុប</div>
            <div class="kpi-val text-emerald">
              {{ activeWorkersCount }} <span class="text-sm font-normal text-mu">/ {{ totalWorkersCount }} នាក់</span>
            </div>
            <div class="kpi-sub">
              <i class="fa-solid fa-circle-check text-emerald"></i> កំពុងបម្រើការងារធម្មតា
            </div>
          </div>
        </div>

        <!-- KPI 2: Total Wages Paid (All-time) -->
        <div class="kpi">
          <div class="kpi-icon-wrap" style="background: rgba(217, 119, 6, 0.15); color: var(--exp);">
            <i class="fa-solid fa-sack-dollar"></i>
          </div>
          <div class="kpi-body">
            <div class="kpi-lbl">ប្រាក់ឈ្នួលបានទូទាត់សរុប</div>
            <div class="kpi-val text-amber">{{ money(totalWagesPaid) }}</div>
            <div class="kpi-sub">
              ខែនេះទូទាត់៖ <b>{{ money(thisMonthWagesPaid) }}</b>
            </div>
          </div>
        </div>

        <!-- KPI 3: Labor Cost to Revenue Ratio -->
        <div class="kpi">
          <div class="kpi-icon-wrap" :style="{
            background: laborCostRatio > 40 ? 'rgba(229, 62, 62, 0.15)' : 'rgba(37, 99, 235, 0.15)',
            color: laborCostRatio > 40 ? 'var(--bad)' : 'var(--profit)'
          }">
            <i class="fa-solid fa-percent"></i>
          </div>
          <div class="kpi-body">
            <div class="kpi-lbl">សមាមាត្រពលកម្ម / ចំណូល</div>
            <div class="kpi-val" :class="laborCostRatio > 40 ? 'text-danger' : 'text-blue'">
              {{ laborCostRatio }}%
            </div>
            <div class="kpi-sub">
              <span v-if="laborCostRatio <= 30" class="badge-status-pill badge-good">
                <i class="fa-solid fa-check"></i> កម្រិតល្អប្រសើរ (&lt;30%)
              </span>
              <span v-else-if="laborCostRatio <= 45" class="badge-status-pill badge-warning">
                <i class="fa-solid fa-triangle-exclamation"></i> កម្រិតមធ្យម (30-45%)
              </span>
              <span v-else class="badge-status-pill badge-danger">
                <i class="fa-solid fa-circle-exclamation"></i> ថ្លៃដើមពលកម្មខ្ពស់
              </span>
            </div>
          </div>
        </div>

        <!-- KPI 4: Avg Wage per Worker -->
        <div class="kpi">
          <div class="kpi-icon-wrap" style="background: rgba(126, 34, 206, 0.15); color: var(--purple);">
            <i class="fa-solid fa-scale-balanced"></i>
          </div>
          <div class="kpi-body">
            <div class="kpi-lbl">ប្រាក់ឈ្នួលមធ្យម / ម្នាក់</div>
            <div class="kpi-val text-purple">{{ money(avgWagePerWorker) }}</div>
            <div class="kpi-sub">
              គិតជាមធ្យមគ្រប់កម្មករទាំងអស់
            </div>
          </div>
        </div>
      </div>

      <!-- Charts & Visual Breakdown Grid -->
      <div class="analytics-charts-grid mb-4">
        <!-- Monthly Wage Trend Bar Chart (Clean SVG Vector) -->
        <div class="card chart-box-card">
          <div class="card-head">
            <h3>
              <i class="fa-solid fa-chart-column text-amber"></i>
              និន្នាការបើកប្រាក់ឈ្នួល ៦ ខែចុងក្រោយ
            </h3>
            <span class="text-xs text-mu">គិតជា {{ state.cur }}</span>
          </div>

          <!-- Professional SVG Bar Chart -->
          <div class="svg-chart-container">
            <svg viewBox="0 0 380 180" class="svg-wage-chart">
              <!-- Horizontal background guidelines -->
              <line x1="10" y1="145" x2="370" y2="145" stroke="var(--ln)" stroke-width="1" />
              <line x1="10" y1="85" x2="370" y2="85" stroke="var(--ln)" stroke-dasharray="3,3" stroke-width="0.8" opacity="0.6" />
              <line x1="10" y1="25" x2="370" y2="25" stroke="var(--ln)" stroke-dasharray="3,3" stroke-width="0.8" opacity="0.6" />

              <!-- Bar groups for each month -->
              <g v-for="(m, i) in monthlyLaborTrend" :key="m.key" :transform="`translate(${i * 60 + 16}, 0)`">
                <!-- Bar Column -->
                <rect 
                  x="6" 
                  :y="145 - chartBarHeight(m.total)" 
                  width="32" 
                  :height="chartBarHeight(m.total)" 
                  rx="4" 
                  class="chart-svg-bar"
                />
                
                <!-- Value on top of bar -->
                <text 
                  v-if="m.total > 0"
                  x="22" 
                  :y="140 - chartBarHeight(m.total)" 
                  text-anchor="middle" 
                  class="svg-bar-val-text"
                >
                  {{ money(m.total) }}
                </text>

                <!-- Month label on x-axis -->
                <text x="22" y="163" text-anchor="middle" class="svg-bar-month-text">
                  {{ m.shortMonth }}
                </text>

                <!-- Count badge -->
                <text x="22" y="176" text-anchor="middle" class="svg-bar-count-text">
                  {{ m.count }} លើក
                </text>
              </g>
            </svg>
          </div>
        </div>

        <!-- Breakdown by Role & Breakdown by Type -->
        <div class="card breakdown-box-card">
          <div class="card-head">
            <h3>
              <i class="fa-solid fa-chart-pie text-emerald"></i>
              ការបែងចែកថ្លៃពលកម្មតាមតួនាទី
            </h3>
            <span class="text-xs text-mu">ភាគរយ %</span>
          </div>

          <div class="roles-progress-list">
            <div v-for="r in roleBreakdown" :key="r.role" class="role-progress-item mb-3">
              <div class="role-header-row">
                <span class="role-name-text">
                  <i class="fa-solid fa-circle-dot text-emerald mr-1"></i>
                  <b>{{ r.role }}</b>
                </span>
                <span class="role-amt-text">
                  {{ money(r.amount) }} <span class="badge-pct">({{ r.pct }}%)</span>
                </span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: r.pct + '%' }"></div>
              </div>
            </div>

            <div v-if="roleBreakdown.length === 0" class="text-center py-4 text-mu">
              មិនទាន់មានទិន្នន័យបើកប្រាក់ឈ្នួលនៅឡើយ
            </div>
          </div>

          <div class="wage-types-footer mt-4 pt-3 border-top">
            <div class="text-xs font-bold text-mu mb-2 uppercase">បែងចែកតាមប្រភេទប្រាក់ឈ្នួល</div>
            <div class="wage-types-grid">
              <div v-for="t in wageTypeBreakdown" :key="t.id" class="wage-type-box">
                <div class="text-xs text-mu">{{ t.name }}</div>
                <div class="text-base font-bold">{{ money(t.amount) }}</div>
                <div class="text-xs text-emerald font-semibold">{{ t.pct }}% នៃសរុប</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Earners / Worker Performance Table -->
      <div class="card">
        <div class="card-head">
          <div>
            <h3>
              <i class="fa-solid fa-ranking-star text-amber"></i>
              តារាងសង្ខេបប្រាក់ឈ្នួល និងសកម្មភាពកម្មករម្នាក់ៗ
            </h3>
            <p class="subtitle">ពិនិត្យមើលបរិមាណបើកប្រាក់ឈ្នួលសរុប និងប្រវត្តិការងាររបស់កម្មករ</p>
          </div>
          <button class="btn btn-outline btn-sm" @click="view = 'workers'">
            <i class="fa-solid fa-list-check"></i> មើលបញ្ជីកម្មករទាំងអស់
          </button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ឈ្មោះកម្មករ</th>
                <th>តួនាទី</th>
                <th>ប្រភេទឈ្នួល</th>
                <th>កម្រៃគោល</th>
                <th class="text-right">ចំនួនលើកបើក</th>
                <th class="text-right">ប្រាក់ឈ្នួលសរុប</th>
                <th>បើកចុងក្រោយ</th>
                <th class="text-center sticky-action-col">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in workerSummaryList" :key="item.worker.id">
                <td>
                  <div class="worker-name-cell">
                    <div class="avatar-circle">
                      <i class="fa-solid fa-user"></i>
                    </div>
                    <div>
                      <div class="font-bold text-tx">{{ item.worker.name }}</div>
                      <div class="text-xs text-mu">{{ item.worker.phone || 'គ្មានលេខ' }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-role">{{ item.worker.role }}</span>
                </td>
                <td>
                  <span class="text-xs text-mu">
                    {{ item.worker.wageType === 'daily' ? 'ប្រចាំថ្ងៃ' : item.worker.wageType === 'monthly' ? 'ប្រចាំខែ' : 'តាមបរិមាណ' }}
                  </span>
                </td>
                <td class="font-mono">{{ money(item.worker.baseRate) }}</td>
                <td class="text-right font-bold">{{ item.paymentsCount }} លើក</td>
                <td class="text-right font-bold text-emerald font-mono">
                  {{ money(item.totalPaid) }}
                </td>
                <td>
                  <span class="text-xs text-mu">{{ item.lastPaymentDate }}</span>
                </td>
                <td class="text-center sticky-action-col">
                  <div class="action-btn-group">
                    <button 
                      class="row-action-btn btn-view" 
                      title="មើលប្រវត្តិបើកប្រាក់"
                      @click="openWorkerHistory(item.worker)"
                    >
                      <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                    <button 
                      class="row-action-btn btn-edit" 
                      title="កត់ត្រាបើកប្រាក់ឈ្នួល"
                      @click="openAddWageModal(item.worker)"
                    >
                      <i class="fa-solid fa-plus"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- VIEW 2: WAGE PAYMENT RECORDS (កត់ត្រាប្រាក់ឈ្នួល) -->
    <!-- ===================================================================== -->
    <div v-else-if="view === 'wages'" class="wages-view">
      <div class="card mb-3 no-print">
        <div class="filter-bar-grid">
          <!-- Search -->
          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-magnifying-glass"></i> ស្វែងរក</label>
            <input 
              v-model="searchWage" 
              type="text" 
              class="form-control" 
              placeholder="ឈ្មោះកម្មករ ឬ ការងារ..." 
            />
          </div>

          <!-- Worker Filter -->
          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-user"></i> តាមកម្មករ</label>
            <select v-model="filterWorker" class="form-control">
              <option value="">-- កម្មករទាំងអស់ --</option>
              <option v-for="w in state.workers" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.role }})
              </option>
            </select>
          </div>

          <!-- Month Filter -->
          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-calendar-days"></i> តាមខែ</label>
            <input v-model="filterMonth" type="month" class="form-control" />
          </div>

          <!-- Reset Filter -->
          <div class="filter-item filter-btn-box">
            <button 
              v-if="searchWage || filterWorker || filterMonth" 
              class="btn btn-outline btn-sm" 
              @click="searchWage = ''; filterWorker = ''; filterMonth = ''"
            >
              <i class="fa-solid fa-xmark"></i> សម្អាតចម្រោះ
            </button>
          </div>
        </div>
      </div>

      <!-- Wage Records Table -->
      <div class="card">
        <div class="card-head">
          <div>
            <h3>
              <i class="fa-solid fa-receipt text-emerald"></i>
              បញ្ជីកំណត់ត្រាប្រាក់ឈ្នួលបានទូទាត់
            </h3>
            <span class="subtitle">បង្ហាញ {{ filteredWages.length }} កំណត់ត្រា | សរុបទឹកប្រាក់៖ <b>{{ money(filteredWages.reduce((s, w) => s + (+w.totalPaid || 0), 0)) }}</b></span>
          </div>
          <button class="btn btn-primary btn-sm" @click="openAddWageModal()">
            <i class="fa-solid fa-plus"></i> កត់ត្រាប្រាក់ឈ្នួលថ្មី
          </button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>កាលបរិច្ឆេទ</th>
                <th>កម្មករ</th>
                <th>ប្រភេទការងារ</th>
                <th>វគ្គផ្សិត</th>
                <th class="text-right">បរិមាណ</th>
                <th class="text-right">តម្លៃឯកតា</th>
                <th class="text-right">បន្ថែម/OT</th>
                <th class="text-right">កាត់ប្រាក់</th>
                <th class="text-right">សរុបទូទាត់</th>
                <th>វិធីទូទាត់</th>
                <th class="text-center sticky-action-col">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="wg in filteredWages" :key="wg.id">
                <td>
                  <span class="font-mono font-medium">{{ wg.date }}</span>
                </td>
                <td>
                  <div class="font-bold text-tx">{{ wg.workerName }}</div>
                  <div class="text-xs text-mu">{{ wName(wg.workerId) !== wg.workerName ? wName(wg.workerId) : '' }}</div>
                </td>
                <td>
                  <b>{{ wg.workType }}</b>
                  <div v-if="wg.note" class="text-xs text-mu truncate max-w-xs">{{ wg.note }}</div>
                </td>
                <td>
                  <span class="badge" :class="wg.batchId ? 'badge-batch' : 'badge-general'">
                    {{ bname(wg.batchId) }}
                  </span>
                </td>
                <td class="text-right font-mono font-semibold">
                  {{ wg.workQty }} {{ wg.unit }}
                </td>
                <td class="text-right font-mono text-mu">
                  {{ money(wg.rate) }}
                </td>
                <td class="text-right font-mono" :class="wg.bonus > 0 ? 'text-emerald' : 'text-mu'">
                  {{ wg.bonus > 0 ? '+' + money(wg.bonus) : '-' }}
                </td>
                <td class="text-right font-mono" :class="wg.deduction > 0 ? 'text-danger' : 'text-mu'">
                  {{ wg.deduction > 0 ? '-' + money(wg.deduction) : '-' }}
                </td>
                <td class="text-right font-mono font-bold text-emerald">
                  {{ money(wg.totalPaid) }}
                </td>
                <td>
                  <span class="badge-payment-method">
                    <i :class="wg.paymentMethod && wg.paymentMethod.includes('ABA') ? 'fa-solid fa-mobile-screen-button text-blue' : 'fa-solid fa-money-bill-wave text-emerald'"></i>
                    {{ wg.paymentMethod }}
                  </span>
                </td>
                <td class="text-center sticky-action-col">
                  <div class="action-btn-group">
                    <button 
                      class="row-action-btn btn-view" 
                      title="មើលប័ណ្ណបើកប្រាក់ (Payslip)"
                      @click="openPayslip(wg)"
                    >
                      <i class="fa-solid fa-print"></i>
                    </button>
                    <button 
                      class="row-action-btn btn-edit" 
                      title="កែប្រែ"
                      @click="openEditWageModal(wg)"
                    >
                      <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button 
                      class="row-action-btn btn-del" 
                      title="លុប"
                      @click="handleDeleteWage(wg)"
                    >
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredWages.length === 0">
                <td colspan="11" class="text-center py-5 text-mu">
                  <div class="empty-state">
                    <i class="fa-solid fa-receipt text-3xl mb-2 opacity-50"></i>
                    <div>មិនមានកំណត់ត្រាប្រាក់ឈ្នួលត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- VIEW 3: WORKERS MANAGEMENT (បញ្ជីឈ្មោះកម្មករ) -->
    <!-- ===================================================================== -->
    <div v-else-if="view === 'workers'" class="workers-list-view">
      <!-- Search & Filters -->
      <div class="card mb-3 no-print">
        <div class="filter-bar-grid">
          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-magnifying-glass"></i> ស្វែងរកកម្មករ</label>
            <input 
              v-model="searchWorker" 
              type="text" 
              class="form-control" 
              placeholder="ឈ្មោះ ឬ លេខទូរស័ព្ទ..." 
            />
          </div>

          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-briefcase"></i> តាមតួនាទី</label>
            <select v-model="filterRole" class="form-control">
              <option value="">-- គ្រប់តួនាទី --</option>
              <option v-for="r in WORKER_ROLES" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>

          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-toggle-on"></i> ស្ថានភាព</label>
            <select v-model="filterStatus" class="form-control">
              <option value="">-- គ្រប់ស្ថានភាព --</option>
              <option value="active">កំពុងធ្វើការ (Active)</option>
              <option value="inactive">ឈប់សម្រាក (Inactive)</option>
            </select>
          </div>

          <div class="filter-item filter-btn-box">
            <button 
              v-if="searchWorker || filterRole || filterStatus" 
              class="btn btn-outline btn-sm" 
              @click="searchWorker = ''; filterRole = ''; filterStatus = ''"
            >
              <i class="fa-solid fa-xmark"></i> សម្អាតចម្រោះ
            </button>
          </div>
        </div>
      </div>

      <!-- Workers Card Grid -->
      <div class="workers-cards-grid">
        <div 
          v-for="w in filteredWorkers" 
          :key="w.id" 
          class="card worker-profile-card"
        >
          <div class="worker-card-top">
            <div class="worker-avatar-box">
              <div class="worker-avatar-lg">
                <i class="fa-solid fa-user-gear"></i>
              </div>
              <div class="worker-identity">
                <h4 class="worker-title">{{ w.name }}</h4>
                <div class="worker-role-tag">{{ w.role }}</div>
              </div>
            </div>

            <div class="worker-status-badge">
              <span 
                class="badge" 
                :class="w.status === 'active' ? 'badge-active' : 'badge-inactive'"
              >
                <i :class="w.status === 'active' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-pause'"></i>
                {{ w.status === 'active' ? 'សកម្ម' : 'ឈប់សម្រាក' }}
              </span>
            </div>
          </div>

          <div class="worker-details-grid my-3">
            <div class="detail-item">
              <span class="detail-lbl"><i class="fa-solid fa-phone"></i> ទូរស័ព្ទ៖</span>
              <a v-if="w.phone" :href="'tel:' + w.phone" class="detail-val font-semibold text-emerald">
                {{ w.phone }}
              </a>
              <span v-else class="detail-val text-mu">មិនមាន</span>
            </div>

            <div class="detail-item">
              <span class="detail-lbl"><i class="fa-solid fa-money-bill-wave"></i> ប្រភេទឈ្នួល៖</span>
              <span class="detail-val font-semibold">
                {{ w.wageType === 'daily' ? 'ប្រចាំថ្ងៃ' : w.wageType === 'monthly' ? 'ប្រចាំខែ' : 'តាមបរិមាណ' }}
              </span>
            </div>

            <div class="detail-item">
              <span class="detail-lbl"><i class="fa-solid fa-tag"></i> កម្រៃគោល៖</span>
              <span class="detail-val font-mono font-bold text-amber">
                {{ money(w.baseRate) }}
              </span>
            </div>

            <div class="detail-item">
              <span class="detail-lbl"><i class="fa-solid fa-calendar"></i> ថ្ងៃចូលធ្វើការ៖</span>
              <span class="detail-val">{{ w.startDate || 'មិនកំណត់' }}</span>
            </div>
          </div>

          <div v-if="w.notes" class="worker-notes-quote mb-3">
            <i class="fa-solid fa-comment-dots text-mu"></i>
            <span>{{ w.notes }}</span>
          </div>

          <div class="worker-card-footer pt-3 border-top">
            <button class="btn btn-primary btn-sm" @click="openAddWageModal(w)">
              <i class="fa-solid fa-hand-holding-dollar"></i> បើកប្រាក់ឈ្នួល
            </button>
            <div class="action-btn-group">
              <button 
                class="row-action-btn btn-view" 
                title="មើលប្រវត្តិបើកប្រាក់"
                @click="openWorkerHistory(w)"
              >
                <i class="fa-solid fa-clock-rotate-left"></i>
              </button>
              <button 
                class="row-action-btn btn-edit" 
                title="កែប្រែព័ត៌មាន"
                @click="openEditWorkerModal(w)"
              >
                <i class="fa-solid fa-pen"></i>
              </button>
              <button 
                class="row-action-btn btn-del" 
                title="លុបកម្មករ"
                @click="handleDeleteWorker(w)"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>

        <div v-if="filteredWorkers.length === 0" class="col-span-full card text-center py-5 text-mu">
          <i class="fa-solid fa-users-slash text-3xl mb-2 opacity-50"></i>
          <div>មិនមានកម្មករត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ</div>
          <button class="btn btn-primary btn-sm mt-3" @click="openAddWorkerModal">
            <i class="fa-solid fa-user-plus"></i> បន្ថែមកម្មករថ្មី
          </button>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- MODAL: ADD / EDIT WORKER -->
    <!-- ===================================================================== -->
    <div v-if="showWorkerModal" class="modal-backdrop" @click.self="showWorkerModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-user-gear text-emerald"></i>
            {{ isEditingWorker ? 'កែប្រែព័ត៌មានកម្មករ' : 'បន្ថែមកម្មករថ្មី' }}
          </h3>
          <button class="icon-btn" @click="showWorkerModal = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form @submit.prevent="handleSaveWorker">
          <div class="modal-body">
            <div class="form-group mb-3">
              <label class="label-text"><i class="fa-solid fa-user"></i> ឈ្មោះកម្មករ *</label>
              <input 
                v-model="workerForm.name" 
                type="text" 
                class="form-control" 
                placeholder="ឧ. សុខ ចាន់ថា" 
                required 
              />
            </div>

            <div class="grid-2-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-phone"></i> លេខទូរស័ព្ទ</label>
                <input 
                  v-model="workerForm.phone" 
                  type="text" 
                  class="form-control" 
                  placeholder="ឧ. 012 345 678" 
                />
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-briefcase"></i> តួនាទី / ការងារ</label>
                <select v-model="workerForm.role" class="form-control">
                  <option v-for="r in WORKER_ROLES" :key="r" :value="r">{{ r }}</option>
                </select>
              </div>
            </div>

            <div class="grid-2-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-calculator"></i> ប្រភេទប្រាក់ឈ្នួល</label>
                <select v-model="workerForm.wageType" class="form-control">
                  <option v-for="t in WAGE_TYPES" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-tag"></i> កម្រៃគោល ({{ state.cur }})</label>
                <input 
                  v-model.number="workerForm.baseRate" 
                  type="number" 
                  class="form-control" 
                  placeholder="ឧ. 35000" 
                  required 
                />
              </div>
            </div>

            <div class="grid-2-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-calendar-day"></i> ថ្ងៃចូលធ្វើការ</label>
                <input 
                  v-model="workerForm.startDate" 
                  type="date" 
                  class="form-control" 
                />
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-toggle-on"></i> ស្ថានភាពការងារ</label>
                <select v-model="workerForm.status" class="form-control">
                  <option value="active">កំពុងបម្រើការងារ (Active)</option>
                  <option value="inactive">ឈប់សម្រាក / ផ្អាក (Inactive)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="label-text"><i class="fa-solid fa-note-sticky"></i> កំណត់សម្គាល់បន្ថែម</label>
              <textarea 
                v-model="workerForm.notes" 
                class="form-control" 
                rows="2" 
                placeholder="ចំណាំបន្ថែមលើបទពិសោធន៍ ឬកិច្ចសន្យា..."
              ></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showWorkerModal = false">បោះបង់</button>
            <button type="submit" class="btn btn-primary">
              <i class="fa-solid fa-check"></i> {{ isEditingWorker ? 'រក្សាទុកការកែប្រែ' : 'បញ្ចូលកម្មករ' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- MODAL: RECORD / EDIT WAGE PAYMENT -->
    <!-- ===================================================================== -->
    <div v-if="showWageModal" class="modal-backdrop" @click.self="showWageModal = false">
      <div class="modal-card modal-lg">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-hand-holding-dollar text-emerald"></i>
            {{ isEditingWage ? 'កែប្រែការបើកប្រាក់ឈ្នួល' : 'កត់ត្រាការបើកប្រាក់ឈ្នួល' }}
          </h3>
          <button class="icon-btn" @click="showWageModal = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form @submit.prevent="handleSaveWageAuto">
          <div class="modal-body">
            <!-- Row 1: Worker & Date -->
            <div class="grid-2-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-user"></i> ជ្រើសរើសកម្មករ *</label>
                <select 
                  v-model="wageForm.workerId" 
                  class="form-control" 
                  required 
                  @change="onWorkerSelectedChange"
                >
                  <option value="" disabled>-- ជ្រើសរើសកម្មករ --</option>
                  <option v-for="w in state.workers" :key="w.id" :value="w.id">
                    {{ w.name }} ({{ w.role }} - {{ money(w.baseRate) }})
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-calendar-day"></i> កាលបរិច្ឆេទបើក *</label>
                <input 
                  v-model="wageForm.date" 
                  type="date" 
                  class="form-control" 
                  required 
                />
              </div>
            </div>

            <!-- Row 2: Work Type & Linked Batch -->
            <div class="grid-2-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-briefcase"></i> ប្រភេទការងារ / ភារកិច្ច</label>
                <input 
                  v-model="wageForm.workType" 
                  type="text" 
                  class="form-control" 
                  placeholder="ឧ. ច្រកថង់ផ្សិត, បេះផ្សិត, មើលថែរោង" 
                  required 
                />
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-layer-group"></i> ភ្ជាប់ជាមួយវគ្គផ្សិត (Batch)</label>
                <select v-model="wageForm.batchId" class="form-control">
                  <option value="">-- ការងារទូទៅក្នុងកសិដ្ឋាន (គ្មានវគ្គ) --</option>
                  <option v-for="b in state.batches" :key="b.id" :value="b.id">
                    {{ b.code }} ({{ b.type }} - {{ b.bags }} ថង់)
                  </option>
                </select>
              </div>
            </div>

            <!-- Row 3: Live Work Qty, Unit & Unit Rate -->
            <div class="grid-3-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-boxes-stacked"></i> បរិមាណការងារ</label>
                <input 
                  v-model.number="wageForm.workQty" 
                  type="number" 
                  step="0.1" 
                  class="form-control" 
                  required 
                  @input="calculateWageTotal" 
                />
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-scale-unbalanced"></i> ឯកតា</label>
                <select v-model="wageForm.unit" class="form-control">
                  <option value="ថ្ងៃ">ថ្ងៃ</option>
                  <option value="ខែ">ខែ</option>
                  <option value="គ.ក">គ.ក</option>
                  <option value="ថង់">ថង់</option>
                  <option value="ជើង">ជើង</option>
                  <option value="ម៉ោង">ម៉ោង</option>
                </select>
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-tag"></i> តម្លៃឯកតា ({{ state.cur }})</label>
                <input 
                  v-model.number="wageForm.rate" 
                  type="number" 
                  class="form-control" 
                  required 
                  @input="calculateWageTotal" 
                />
              </div>
            </div>

            <!-- Row 4: Bonus & Deduction -->
            <div class="grid-2-col mb-3">
              <div class="form-group">
                <label class="label-text text-emerald"><i class="fa-solid fa-plus-circle"></i> ប្រាក់បន្ថែម / OT ({{ state.cur }})</label>
                <input 
                  v-model.number="wageForm.bonus" 
                  type="number" 
                  class="form-control" 
                  placeholder="0" 
                  @input="calculateWageTotal" 
                />
              </div>

              <div class="form-group">
                <label class="label-text text-danger"><i class="fa-solid fa-minus-circle"></i> កាត់ប្រាក់ / ខ្ចីមុន ({{ state.cur }})</label>
                <input 
                  v-model.number="wageForm.deduction" 
                  type="number" 
                  class="form-control" 
                  placeholder="0" 
                  @input="calculateWageTotal" 
                />
              </div>
            </div>

            <!-- Row 5: Total Calculation Summary Box -->
            <div class="wage-calc-summary-box mb-3">
              <div class="calc-row">
                <span>ប្រាក់ឈ្នួលដើម ({{ wageForm.workQty }} {{ wageForm.unit }} × {{ money(wageForm.rate) }}):</span>
                <b class="font-mono">{{ money((+wageForm.workQty || 0) * (+wageForm.rate || 0)) }}</b>
              </div>
              <div v-if="wageForm.bonus > 0" class="calc-row text-emerald">
                <span><i class="fa-solid fa-plus"></i> ប្រាក់លើកទឹកចិត្ត/ថែមម៉ោង៖</span>
                <b class="font-mono">+{{ money(wageForm.bonus) }}</b>
              </div>
              <div v-if="wageForm.deduction > 0" class="calc-row text-danger">
                <span><i class="fa-solid fa-minus"></i> កាត់ប្រាក់/ខ្ចីមុន៖</span>
                <b class="font-mono">-{{ money(wageForm.deduction) }}</b>
              </div>
              <div class="calc-row calc-total-row pt-2 border-top">
                <span class="text-base font-bold">ទឹកប្រាក់សរុបត្រូវទូទាត់៖</span>
                <span class="text-xl font-bold text-emerald font-mono">{{ money(wageForm.totalPaid) }}</span>
              </div>
            </div>

            <!-- Row 6: Payment Method & Expense Sync -->
            <div class="grid-2-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-credit-card"></i> វិធីសាស្ត្រទូទាត់</label>
                <select v-model="wageForm.paymentMethod" class="form-control">
                  <option value="សាច់ប្រាក់ (Cash)">សាច់ប្រាក់ (Cash)</option>
                  <option value="ABA Pay">ABA Pay</option>
                  <option value="Wing Pay">Wing Pay</option>
                  <option value="Acleda / KHQR">Acleda / KHQR</option>
                  <option value="ផ្ទេរប្រាក់តាមធនាគារ">ផ្ទេរប្រាក់តាមធនាគារ</option>
                </select>
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-cloud-arrow-up"></i> កត់ត្រាចូលចំណាយ</label>
                <label class="checkbox-label-box">
                  <input type="checkbox" v-model="wageForm.syncToExpense" />
                  <span>កត់ត្រាចូលតារាង <b>ចំណាយ (Expenses)</b> ដោយស្វ័យប្រវត្តិ</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="label-text"><i class="fa-solid fa-note-sticky"></i> កំណត់សម្គាល់បន្ថែម</label>
              <input 
                v-model="wageForm.note" 
                type="text" 
                class="form-control" 
                placeholder="ឧ. បើកប្រាក់លើការងារច្រកថង់ និងចំហុយ..." 
              />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showWageModal = false">បោះបង់</button>
            <button type="submit" class="btn btn-primary">
              <i class="fa-solid fa-check"></i> {{ isEditingWage ? 'រក្សាទុកការកែប្រែ' : 'កត់ត្រាការបើកប្រាក់' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- MODAL: WORKER PAYMENT HISTORY -->
    <!-- ===================================================================== -->
    <div v-if="showHistoryModal && selectedWorkerForHistory" class="modal-backdrop" @click.self="showHistoryModal = false">
      <div class="modal-card modal-lg">
        <div class="modal-header">
          <div>
            <h3>
              <i class="fa-solid fa-clock-rotate-left text-emerald"></i>
              ប្រវត្តិបើកប្រាក់ឈ្នួល៖ {{ selectedWorkerForHistory.name }}
            </h3>
            <span class="subtitle">{{ selectedWorkerForHistory.role }} | {{ selectedWorkerForHistory.phone || 'គ្មានលេខ' }}</span>
          </div>
          <button class="icon-btn" @click="showHistoryModal = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="modal-body modal-scroll">
          <div class="kpi-mini-grid mb-3">
            <div class="kpi-mini-card">
              <span class="text-xs text-mu">សរុបលើកបើកប្រាក់</span>
              <span class="text-lg font-bold">{{ workerHistoryWages.length }} លើក</span>
            </div>
            <div class="kpi-mini-card">
              <span class="text-xs text-mu">ទឹកប្រាក់សរុបទទួលបាន</span>
              <span class="text-lg font-bold text-emerald font-mono">{{ money(workerHistoryTotalPaid) }}</span>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>កាលបរិច្ឆេទ</th>
                  <th>ការងារ</th>
                  <th>បរិមាណ</th>
                  <th class="text-right">សរុបទូទាត់</th>
                  <th>វិធីទូទាត់</th>
                  <th class="text-center">សន្លឹកបើក</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="wg in workerHistoryWages" :key="wg.id">
                  <td class="font-mono text-sm">{{ wg.date }}</td>
                  <td>
                    <b>{{ wg.workType }}</b>
                    <span v-if="wg.batchId" class="badge badge-batch ml-1">{{ bname(wg.batchId) }}</span>
                  </td>
                  <td class="font-mono">{{ wg.workQty }} {{ wg.unit }}</td>
                  <td class="text-right font-mono font-bold text-emerald">{{ money(wg.totalPaid) }}</td>
                  <td><span class="text-xs text-mu">{{ wg.paymentMethod }}</span></td>
                  <td class="text-center sticky-action-col">
                    <button class="btn btn-outline btn-xs" @click="openPayslip(wg)">
                      <i class="fa-solid fa-print"></i> Payslip
                    </button>
                  </td>
                </tr>
                <tr v-if="workerHistoryWages.length === 0">
                  <td colspan="6" class="text-center py-4 text-mu">មិនទាន់មានប្រវត្តិបើកប្រាក់ឈ្នួលឡើយ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="showHistoryModal = false">បិទ</button>
          <button class="btn btn-primary" @click="openAddWageModal(selectedWorkerForHistory); showHistoryModal = false">
            <i class="fa-solid fa-plus"></i> កត់ត្រាបើកប្រាក់ថ្មី
          </button>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- MODAL: OFFICIAL PRINTABLE PAYSLIP (ប័ណ្ណបើកប្រាក់ឈ្នួល) -->
    <!-- ===================================================================== -->
    <div v-if="showPayslipModal && selectedWageForPayslip" class="modal-backdrop" @click.self="showPayslipModal = false">
      <div class="modal-card modal-payslip">
        <div class="modal-header no-print">
          <h3><i class="fa-solid fa-print text-emerald"></i> ប័ណ្ណបើកប្រាក់ឈ្នួល (Payslip)</h3>
          <button class="icon-btn" @click="showPayslipModal = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Printable Document Area -->
        <div class="modal-body printable-payslip-content">
          <!-- Farm & Payslip Header -->
          <div class="payslip-top-row">
            <div class="payslip-farm-info">
              <h2 class="payslip-farm-title">{{ state.settings.farmName || 'កសិដ្ឋានផ្សិត' }}</h2>
              <div class="text-xs text-mu">{{ state.settings.address || 'ប្រទេសកម្ពុជា' }} | ទូរស័ព្ទ៖ {{ state.settings.phone || '012 345 678' }}</div>
            </div>
            <div class="payslip-doc-badge">
              <h3 class="doc-badge-title">ប័ណ្ណបើកប្រាក់ឈ្នួល</h3>
              <div class="doc-badge-sub">PAYSLIP VOUCHER</div>
              <div class="doc-badge-date">លេខកូដ៖ #PAY-{{ selectedWageForPayslip.id }}</div>
            </div>
          </div>

          <div class="payslip-meta-grid my-3">
            <div class="meta-box">
              <span class="meta-lbl">ឈ្មោះកម្មករ / និយោជិត៖</span>
              <b class="meta-val">{{ selectedWageForPayslip.workerName }}</b>
            </div>
            <div class="meta-box">
              <span class="meta-lbl">កាលបរិច្ឆេទបើកប្រាក់៖</span>
              <b class="meta-val font-mono">{{ selectedWageForPayslip.date }}</b>
            </div>
            <div class="meta-box">
              <span class="meta-lbl">ភារកិច្ច / តួនាទី៖</span>
              <b class="meta-val">{{ selectedWageForPayslip.workType }}</b>
            </div>
            <div class="meta-box">
              <span class="meta-lbl">វគ្គផលិតកម្ម / រោង៖</span>
              <b class="meta-val">{{ bname(selectedWageForPayslip.batchId) }}</b>
            </div>
          </div>

          <!-- Earnings Table -->
          <table class="payslip-table my-3">
            <thead>
              <tr>
                <th>បរិយាយ (Description)</th>
                <th class="text-center">បរិមាណ (Qty)</th>
                <th class="text-right">តម្លៃឯកតា (Rate)</th>
                <th class="text-right">ទឹកប្រាក់ (Amount)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>ប្រាក់ឈ្នួលការងារ ({{ selectedWageForPayslip.workType }})</b>
                  <div v-if="selectedWageForPayslip.note" class="text-xs text-mu">{{ selectedWageForPayslip.note }}</div>
                </td>
                <td class="text-center font-mono">{{ selectedWageForPayslip.workQty }} {{ selectedWageForPayslip.unit }}</td>
                <td class="text-right font-mono">{{ money(selectedWageForPayslip.rate) }}</td>
                <td class="text-right font-mono font-bold">{{ money((+selectedWageForPayslip.workQty || 1) * (+selectedWageForPayslip.rate || 0)) }}</td>
              </tr>
              <tr v-if="selectedWageForPayslip.bonus > 0">
                <td colspan="3" class="text-emerald">
                  <i class="fa-solid fa-plus-circle"></i> ប្រាក់បន្ថែម / OT / លើកទឹកចិត្ត
                </td>
                <td class="text-right font-mono font-bold text-emerald">+{{ money(selectedWageForPayslip.bonus) }}</td>
              </tr>
              <tr v-if="selectedWageForPayslip.deduction > 0">
                <td colspan="3" class="text-danger">
                  <i class="fa-solid fa-minus-circle"></i> កាត់ប្រាក់ / ខ្ចីមុន
                </td>
                <td class="text-right font-mono font-bold text-danger">-{{ money(selectedWageForPayslip.deduction) }}</td>
              </tr>
              <tr class="payslip-net-row">
                <td colspan="3" class="font-bold text-base">
                  ទឹកប្រាក់សរុបទូទាត់ (NET SALARY PAID)
                </td>
                <td class="text-right font-mono font-bold text-xl text-emerald">
                  {{ money(selectedWageForPayslip.totalPaid) }}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="payslip-payment-footer-info mb-4">
            <div>វិធីសាស្ត្រទូទាត់៖ <b>{{ selectedWageForPayslip.paymentMethod }}</b></div>
            <div>ស្ថានភាព៖ <span class="badge badge-good">ទូទាត់រួចរាល់ (PAID)</span></div>
          </div>

          <!-- Signature Lines -->
          <div class="payslip-signatures-row mt-5 pt-4">
            <div class="sign-col text-center">
              <div class="sign-title">ហត្ថលេខាអ្នកទទួលប្រាក់</div>
              <div class="sign-space"></div>
              <div class="sign-name"><b>{{ selectedWageForPayslip.workerName }}</b></div>
              <div class="sign-date">កាលបរិច្ឆេទ៖ ____/____/2026</div>
            </div>

            <div class="sign-col text-center">
              <div class="sign-title">ហត្ថលេខាអ្នកប្រគល់ / Admin</div>
              <div class="sign-space"></div>
              <div class="sign-name"><b>{{ state.settings.owner || 'អ្នកគ្រប់គ្រងកសិដ្ឋាន' }}</b></div>
              <div class="sign-date">កាលបរិច្ឆេទ៖ ____/____/2026</div>
            </div>
          </div>
        </div>

        <div class="modal-footer no-print">
          <button class="btn btn-outline" @click="showPayslipModal = false">បិទ</button>
          <button class="btn btn-primary" @click="printCurrentPayslip">
            <i class="fa-solid fa-print"></i> បោះពុម្ពប័ណ្ណ (Print Payslip)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Header & Sub-Navigation Tabs */
.card-payroll-header {
  padding: 22px 24px;
}

.header-main-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.badge-role-count {
  font-size: 12px;
  background: var(--ac-light);
  color: var(--ac);
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sub-nav-tabs {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--ln);
  padding-top: 16px;
  flex-wrap: wrap;
}

.sub-tab-btn {
  background: var(--bg);
  border: 1px solid var(--ln);
  color: var(--mu);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  padding: 9px 18px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.sub-tab-btn:hover {
  color: var(--tx);
  border-color: var(--ac);
}

.sub-tab-btn.active {
  background: var(--ac);
  color: #ffffff;
  border-color: var(--ac);
  box-shadow: 0 2px 6px rgba(47, 125, 79, 0.35);
}

/* Analytics Grid Layout */
.analytics-charts-grid {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 18px;
}
@media (max-width: 900px) {
  .analytics-charts-grid {
    grid-template-columns: 1fr;
  }
}

/* SVG Chart Box */
.svg-chart-container {
  width: 100%;
  padding-top: 8px;
}

.svg-wage-chart {
  width: 100%;
  height: 200px;
  overflow: visible;
}

.chart-svg-bar {
  fill: #f59e0b;
  transition: all 0.3s ease;
  cursor: pointer;
}
.chart-svg-bar:hover {
  fill: #d97706;
  opacity: 0.9;
}

.svg-bar-val-text {
  font-size: 9.5px;
  font-weight: 700;
  fill: var(--tx);
  font-family: inherit;
}

.svg-bar-month-text {
  font-size: 11px;
  font-weight: 600;
  fill: var(--tx);
  font-family: inherit;
}

.svg-bar-count-text {
  font-size: 9.5px;
  fill: var(--mu);
  font-family: inherit;
}

/* Roles Breakdown */
.role-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13.5px;
  margin-bottom: 5px;
}

.badge-pct {
  color: var(--mu);
  font-size: 12px;
  margin-left: 4px;
}

.wage-types-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.wage-type-box {
  background: var(--bg);
  border: 1px solid var(--ln);
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
}

/* Worker Cards */
.workers-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.worker-profile-card {
  padding: 18px;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.worker-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.worker-avatar-box {
  display: flex;
  align-items: center;
  gap: 12px;
}

.worker-avatar-lg {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--ac-light);
  color: var(--ac);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.worker-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.worker-role-tag {
  font-size: 12px;
  color: var(--mu);
  margin-top: 2px;
}

.worker-details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 12.5px;
}

.detail-item {
  display: flex;
  flex-direction: column;
}

.detail-lbl {
  font-size: 11px;
  color: var(--mu);
}

.worker-notes-quote {
  font-size: 12px;
  color: var(--mu);
  background: var(--bg);
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-style: italic;
}

.worker-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.badge-active {
  background: var(--ac-light);
  color: var(--ac);
  border: 1px solid rgba(47, 125, 79, 0.2);
}

.badge-inactive {
  background: var(--bg);
  color: var(--mu);
  border: 1px solid var(--ln);
}

.badge-role {
  background: var(--profit-light);
  color: var(--profit);
  font-size: 12px;
}

.badge-status-pill {
  font-size: 11px;
  font-weight: 700;
}

.badge-good { color: var(--ac); }
.badge-warning { color: var(--exp); }
.badge-danger { color: var(--bad); }

/* Wage Calculation Summary in Modal */
.wage-calc-summary-box {
  background: var(--bg);
  border: 1px dashed var(--ac);
  border-radius: 10px;
  padding: 14px;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13.5px;
  margin-bottom: 4px;
}

.calc-total-row {
  margin-top: 6px;
  margin-bottom: 0;
}

.badge-payment-method {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  background: var(--bg);
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--ln);
}

/* Worker cell with circle */
.worker-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ac-light);
  color: var(--ac);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.kpi-mini-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.kpi-mini-card {
  background: var(--bg);
  border: 1px solid var(--ln);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

/* Printable Payslip Modal */
.modal-payslip {
  max-width: 640px;
}

.printable-payslip-content {
  background: #ffffff;
  color: #1e2922;
  padding: 24px;
  border-radius: 8px;
}

.payslip-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--ac);
  padding-bottom: 14px;
}

.payslip-farm-title {
  font-size: 20px;
  color: var(--ac);
  font-weight: 800;
}

.payslip-doc-badge {
  text-align: right;
}

.doc-badge-title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.doc-badge-sub {
  font-size: 10px;
  font-weight: 700;
  color: var(--mu);
}

.doc-badge-date {
  font-size: 11px;
  font-family: monospace;
  color: var(--mu);
  margin-top: 2px;
}

.payslip-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.meta-box {
  display: flex;
  flex-direction: column;
}

.meta-lbl {
  font-size: 11px;
  color: #64748b;
}

.meta-val {
  font-size: 13.5px;
  color: #0f172a;
}

.payslip-table {
  width: 100%;
  border-collapse: collapse;
}

.payslip-table th {
  background: #f1f5f9;
  color: #334155;
  font-weight: 700;
  font-size: 12px;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
}

.payslip-table td {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  font-size: 13px;
  color: #0f172a;
}

.payslip-net-row td {
  background: #f0fdf4;
  border-top: 2px solid var(--ac);
}

.payslip-signatures-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}

.sign-title {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}

.sign-space {
  height: 60px;
}

.sign-name {
  font-size: 13px;
  border-top: 1px solid #94a3b8;
  padding-top: 4px;
}

.sign-date {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

@media print {
  body * {
    visibility: hidden;
  }
  .printable-payslip-content, .printable-payslip-content * {
    visibility: visible;
  }
  .printable-payslip-content {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 20px;
  }
}

.status-radios { display: flex; gap: 10px; align-items: center; }
.radio-label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.radio-label input { margin: 0; }


.att-badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-block; }
.att-success { background: rgba(56, 161, 105, 0.15); color: var(--inc); border: 1px solid rgba(56, 161, 105, 0.3); }
.att-warning { background: rgba(221, 107, 32, 0.15); color: var(--exp); border: 1px solid rgba(221, 107, 32, 0.3); }
.att-danger { background: rgba(229, 62, 62, 0.15); color: var(--bad); border: 1px solid rgba(229, 62, 62, 0.3); }
.att-secondary { background: var(--bg-hover); color: var(--mu); border: 1px solid var(--ln); }
.status-radios { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.radio-label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.radio-label input { width: 16px; height: 16px; cursor: pointer; }

</style>
