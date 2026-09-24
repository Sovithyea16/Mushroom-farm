<script setup>
import { ref, computed } from 'vue'
import {
  state,
  money,
  fmt,
  bname,
  matName,
  MATERIAL_CATS,
  MATERIAL_UNITS,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  recordStockMovement,
  deleteStockMovement,
  exportToCSV,
  showToast,
  askConfirm,
  isAdmin
} from '../store'

// Current sub-tab: 'stock' | 'movements' | 'analytics'
const view = ref('stock')

// Filters for Material Stock
const searchMat = ref('')
const filterCat = ref('')
const filterAlertOnly = ref(false)

// Filters for Stock Movements
const searchMov = ref('')
const filterMovType = ref('')
const filterMovMat = ref('')

// Modals
const showMatModal = ref(false)
const isEditingMat = ref(false)
const matForm = ref({
  id: null,
  name: '',
  cat: MATERIAL_CATS[0],
  currentStock: 0,
  unit: 'គ.ក',
  minStock: 20,
  unitCost: 1000,
  supplier: '',
  notes: '',
})

const showMovModal = ref(false)
const movType = ref('in') // 'in' or 'out'
const movForm = ref({
  materialId: '',
  type: 'in',
  date: new Date().toISOString().slice(0, 10),
  qty: 1,
  unitCost: 0,
  totalCost: 0,
  batchId: '',
  supplier: '',
  note: '',
  syncToExpense: true,
})

// Item History Modal
const showHistoryModal = ref(false)
const selectedMatForHistory = ref(null)

// =========================================================================
// Computed Metrics & Analytics
// =========================================================================
const materialsList = computed(() => state.materials || [])
const movementsList = computed(() => state.stockMovements || [])

const totalItemsCount = computed(() => materialsList.value.length)

// Total Inventory Value = sum(currentStock * unitCost)
const totalInventoryValue = computed(() => {
  return materialsList.value.reduce((sum, m) => sum + ((+m.currentStock || 0) * (+m.unitCost || 0)), 0)
})

// Low Stock Alerts List (currentStock <= minStock)
const lowStockItems = computed(() => {
  return materialsList.value.filter(m => (+m.currentStock || 0) <= (+m.minStock || 0))
})

const thisMonthKey = new Date().toISOString().slice(0, 7)
const thisMonthPurchases = computed(() => {
  return movementsList.value
    .filter(m => m.type === 'in' && m.date && m.date.startsWith(thisMonthKey))
    .reduce((sum, m) => sum + (+m.totalCost || 0), 0)
})

const thisMonthUsageCount = computed(() => {
  return movementsList.value.filter(m => m.type === 'out' && m.date && m.date.startsWith(thisMonthKey)).length
})

// Category Breakdown
const catBreakdown = computed(() => {
  const map = {}
  materialsList.value.forEach(m => {
    const c = m.cat || 'ផ្សេងៗ'
    if (!map[c]) map[c] = { count: 0, value: 0 }
    map[c].count += 1
    map[c].value += (+m.currentStock || 0) * (+m.unitCost || 0)
  })
  const totalVal = totalInventoryValue.value || 1
  return Object.entries(map).map(([cat, d]) => ({
    cat,
    count: d.count,
    value: d.value,
    pct: Math.round((d.value / totalVal) * 1000) / 10
  })).sort((a, b) => b.value - a.value)
})

// =========================================================================
// Filtered Views
// =========================================================================
const filteredMaterials = computed(() => {
  return materialsList.value.filter(m => {
    if (searchMat.value) {
      const q = searchMat.value.toLowerCase()
      const matchName = (m.name || '').toLowerCase().includes(q)
      const matchSup = (m.supplier || '').toLowerCase().includes(q)
      if (!matchName && !matchSup) return false
    }
    if (filterCat.value && m.cat !== filterCat.value) return false
    if (filterAlertOnly.value && (+m.currentStock || 0) > (+m.minStock || 0)) return false
    return true
  })
})

const filteredMovements = computed(() => {
  return movementsList.value.filter(m => {
    if (searchMov.value) {
      const q = searchMov.value.toLowerCase()
      const matchName = (m.materialName || '').toLowerCase().includes(q)
      const matchNote = (m.note || '').toLowerCase().includes(q)
      if (!matchName && !matchNote) return false
    }
    if (filterMovType.value && m.type !== filterMovType.value) return false
    if (filterMovMat.value && m.materialId !== +filterMovMat.value) return false
    return true
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
})

// =========================================================================
// Actions: Material CRUD
// =========================================================================
function openAddMaterialModal() {
  isEditingMat.value = false
  matForm.value = {
    id: null,
    name: '',
    cat: MATERIAL_CATS[0],
    currentStock: 0,
    unit: 'គ.ក',
    minStock: 20,
    unitCost: 1000,
    supplier: '',
    notes: '',
  }
  showMatModal.value = true
}

function openEditMaterialModal(mat) {
  isEditingMat.value = true
  matForm.value = { ...mat }
  showMatModal.value = true
}

function handleSaveMaterial() {
  if (!matForm.value.name.trim()) {
    showToast('សូមបញ្ចូលឈ្មោះវត្ថុធាតុដើម!', 'error')
    return
  }
  if (isEditingMat.value) {
    updateMaterial(matForm.value.id, matForm.value)
    showToast('កែប្រែព័ត៌មាន «' + matForm.value.name + '» ជោគជ័យ!', 'success')
  } else {
    addMaterial(matForm.value)
    showToast('បានបន្ថែម «' + matForm.value.name + '» ទៅក្នុងស្តុកដោយជោគជ័យ!', 'success')
  }
  showMatModal.value = false
}

async function handleDeleteMaterial(mat) {
  const ok = await askConfirm({
    title: 'លុបមុខទំនិញពីស្តុក',
    message: 'តើអ្នកពិតជាចង់លុប «' + mat.name + '» ចេញពីបញ្ជីស្តុកមែនទេ?',
    confirmText: 'លុបទំនិញ',
    type: 'danger'
  })
  if (ok) {
    deleteMaterial(mat.id)
    showToast('បានលុប «' + mat.name + '» រួចរាល់', 'info')
  }
}

// =========================================================================
// Actions: Stock In / Stock Out
// =========================================================================
function openStockInModal(presetMat = null) {
  movType.value = 'in'
  const defaultMat = presetMat || materialsList.value[0]
  movForm.value = {
    materialId: defaultMat ? defaultMat.id : '',
    type: 'in',
    date: new Date().toISOString().slice(0, 10),
    qty: 10,
    unitCost: defaultMat ? defaultMat.unitCost : 1000,
    totalCost: (defaultMat ? defaultMat.unitCost : 1000) * 10,
    batchId: '',
    supplier: defaultMat ? defaultMat.supplier : '',
    note: '',
    syncToExpense: true,
  }
  calculateMovTotal()
  showMovModal.value = true
}

function openStockOutModal(presetMat = null) {
  movType.value = 'out'
  const defaultMat = presetMat || materialsList.value[0]
  movForm.value = {
    materialId: defaultMat ? defaultMat.id : '',
    type: 'out',
    date: new Date().toISOString().slice(0, 10),
    qty: 5,
    unitCost: defaultMat ? defaultMat.unitCost : 1000,
    totalCost: 0,
    batchId: state.batches.length ? state.batches[0].id : '',
    supplier: '',
    note: '',
    syncToExpense: false,
  }
  showMovModal.value = true
}

function onMovMaterialChange() {
  const mat = materialsList.value.find(m => m.id === movForm.value.materialId)
  if (mat) {
    movForm.value.unitCost = mat.unitCost || 0
    if (movType.value === 'in') {
      movForm.value.supplier = mat.supplier || ''
    }
  }
  calculateMovTotal()
}

function calculateMovTotal() {
  movForm.value.totalCost = (+movForm.value.qty || 0) * (+movForm.value.unitCost || 0)
}

function handleSaveMovement() {
  if (!movForm.value.materialId) {
    showToast('សូមជ្រើសរើសមុខទំនិញ!', 'error')
    return
  }
  if (!movForm.value.qty || movForm.value.qty <= 0) {
    showToast('សូមបញ្ចូលបរិមាណត្រឹមត្រូវ!', 'error')
    return
  }

  const mat = materialsList.value.find(m => m.id === movForm.value.materialId)
  if (movType.value === 'out' && mat && mat.currentStock < movForm.value.qty) {
    showToast('បរិមាណដកប្រើលើសពីចំនួនស្តុកជាក់ស្តែងដែលមាន (' + mat.currentStock + ' ' + mat.unit + ')!', 'error', 'ស្តុកមិនគ្រប់')
    return
  }

  movForm.value.type = movType.value
  calculateMovTotal()
  recordStockMovement(movForm.value, movForm.value.syncToExpense)

  if (movType.value === 'in') {
    showToast('បាននាំចូលស្តុក «' + (mat ? mat.name : '') + '» ដោយជោគជ័យ!', 'success')
  } else {
    showToast('បានដកប្រើប្រាស់ «' + (mat ? mat.name : '') + '» ដោយជោគជ័យ!', 'info')
  }
  showMovModal.value = false
}

async function handleDeleteMovement(mov) {
  const ok = await askConfirm({
    title: 'លុបកំណត់ត្រាចលនាស្តុក',
    message: 'តើអ្នកពិតជាចង់លុបកំណត់ត្រានេះមែនទេ? ចំនួនស្តុកនឹងត្រូវកែសម្រួលត្រឡប់វិញស្វ័យប្រវត្តិ។',
    confirmText: 'លុបកំណត់ត្រា',
    type: 'danger'
  })
  if (ok) {
    deleteStockMovement(mov.id)
    showToast('បានលុបកំណត់ត្រាចលនាស្តុក និងកែប្រែចំនួនស្តុកត្រឡប់វិញជោគជ័យ', 'info')
  }
}

// History Modal
function openMaterialHistory(mat) {
  selectedMatForHistory.value = mat
  showHistoryModal.value = true
}

const materialHistoryMovements = computed(() => {
  if (!selectedMatForHistory.value) return []
  return movementsList.value
    .filter(m => m.materialId === selectedMatForHistory.value.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

// CSV Export
function exportInventoryCSV() {
  const headers = ['ឈ្មោះវត្ថុធាតុដើម', 'ប្រភេទ', 'ស្តុកបច្ចុប្បន្ន', 'ឯកតា', 'កម្រិតរំលឹក', 'តម្លៃទិញជាមធ្យម', 'តម្លៃស្តុកសរុប', 'អ្នកផ្គត់ផ្គង់', 'ស្ថានភាព']
  const rows = filteredMaterials.value.map(m => {
    const isLow = (+m.currentStock || 0) <= (+m.minStock || 0)
    return [
      m.name,
      m.cat,
      m.currentStock,
      m.unit,
      m.minStock,
      money(m.unitCost),
      money((+m.currentStock || 0) * (+m.unitCost || 0)),
      m.supplier || '-',
      isLow ? 'ជិតអស់ពីស្តុក' : 'ធម្មតា'
    ]
  })
  exportToCSV('mushroom-inventory-' + new Date().toISOString().slice(0, 10), headers, rows)
  showToast('បាន Export បញ្ជីស្តុកជា CSV រួចរាល់!', 'success')
}
</script>

<template>
  <div class="inventory-page">
    <!-- Header Section -->
    <div class="card card-inv-header mb-4">
      <div class="header-main-row">
        <div class="header-titles">
          <div class="title-with-badge">
            <h2>
              <i class="fa-solid fa-boxes-stacked text-emerald"></i>
              ស្តុកវត្ថុធាតុដើម & សម្ភារៈ (Raw Materials & Inventory)
            </h2>
            <span v-if="lowStockItems.length > 0" class="badge-low-alert">
              <i class="fa-solid fa-triangle-exclamation"></i> {{ lowStockItems.length }} មុខជិតអស់
            </span>
          </div>
          <p class="subtitle">
            គ្រប់គ្រងបរិមាណមេផ្សិត ថង់ដាំ អាចម៍រណារ កន្ទក់ កំបោរ កត់ត្រានាំចូល និងដកប្រើប្រាស់
          </p>
        </div>

        <div class="header-actions-group no-print">
          <button class="btn btn-primary" @click="openStockInModal()">
            <i class="fa-solid fa-arrow-down-to-bracket"></i>
            <span>នាំចូលស្តុក (Stock In)</span>
          </button>
          <button class="btn btn-outline" @click="openStockOutModal()">
            <i class="fa-solid fa-arrow-up-from-bracket text-amber"></i>
            <span>ដកប្រើប្រាស់ (Stock Out)</span>
          </button>
          <button class="btn btn-outline" @click="openAddMaterialModal()">
            <i class="fa-solid fa-plus"></i>
            <span>បន្ថែមមុខទំនិញ</span>
          </button>
          <button class="btn btn-outline" title="ទាញយកជា CSV" @click="exportInventoryCSV">
            <i class="fa-solid fa-file-csv text-emerald"></i>
            <span>CSV</span>
          </button>
        </div>
      </div>

      <!-- Navigation Sub-Tabs -->
      <div class="sub-nav-tabs mt-3 no-print">
        <button 
          :class="['sub-tab-btn', { active: view === 'stock' }]" 
          @click="view = 'stock'"
        >
          <i class="fa-solid fa-boxes-stacked"></i>
          <span>បញ្ជីស្តុកបច្ចុប្បន្ន ({{ materialsList.length }})</span>
        </button>
        <button 
          :class="['sub-tab-btn', { active: view === 'movements' }]" 
          @click="view = 'movements'"
        >
          <i class="fa-solid fa-clock-rotate-left"></i>
          <span>កំណត់ត្រាចលនាស្តុក ({{ movementsList.length }})</span>
        </button>
        <button 
          :class="['sub-tab-btn', { active: view === 'analytics' }]" 
          @click="view = 'analytics'"
        >
          <i class="fa-solid fa-chart-pie"></i>
          <span>វិភាគតម្លៃស្តុក & ប្រភេទ</span>
        </button>
      </div>
    </div>

    <!-- Low Stock Alert Banner -->
    <div v-if="lowStockItems.length > 0" class="low-stock-banner card mb-4">
      <div class="banner-icon">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <div class="banner-body">
        <h4>ការជូនដំណឹង៖ វត្ថុធាតុដើមជិតអស់ពីស្តុក ({{ lowStockItems.length }} មុខ)</h4>
        <div class="low-items-chips-row">
          <span 
            v-for="item in lowStockItems" 
            :key="item.id" 
            class="low-item-chip"
            @click="openStockInModal(item)"
          >
            <b>{{ item.name }}</b>៖ នៅសល់ <span class="text-danger font-bold">{{ item.currentStock }} {{ item.unit }}</span> (កម្រិតរំលឹក: {{ item.minStock }}) 
            <i class="fa-solid fa-circle-plus ml-1 text-emerald" title="ចុចដើម្បីនាំចូល"></i>
          </span>
        </div>
      </div>
    </div>

    <!-- 4 Top KPI Cards -->
    <div class="kpis mb-4">
      <div class="kpi">
        <div class="kpi-icon-wrap" style="background: rgba(47, 125, 79, 0.15); color: var(--ac);">
          <i class="fa-solid fa-boxes-stacked"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-lbl">មុខទំនិញក្នុងស្តុកសរុប</div>
          <div class="kpi-val text-emerald">{{ totalItemsCount }} <span class="text-sm font-normal text-mu">មុខ</span></div>
          <div class="kpi-sub">
            <span v-if="lowStockItems.length === 0" class="text-emerald"><i class="fa-solid fa-check"></i> ស្តុកគ្រប់គ្រាន់ល្អ</span>
            <span v-else class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> {{ lowStockItems.length }} មុខជិតអស់</span>
          </div>
        </div>
      </div>

      <div class="kpi">
        <div class="kpi-icon-wrap" style="background: rgba(37, 99, 235, 0.15); color: var(--profit);">
          <i class="fa-solid fa-sack-dollar"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-lbl">តម្លៃទំនិញក្នុងស្តុកសរុប</div>
          <div class="kpi-val text-blue">{{ money(totalInventoryValue) }}</div>
          <div class="kpi-sub">គណនាផ្អែកលើតម្លៃទិញជាមធ្យម</div>
        </div>
      </div>

      <div class="kpi">
        <div class="kpi-icon-wrap" style="background: rgba(217, 119, 6, 0.15); color: var(--exp);">
          <i class="fa-solid fa-cart-shopping"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-lbl">ទិញចូលក្នុងខែនេះ</div>
          <div class="kpi-val text-amber">{{ money(thisMonthPurchases) }}</div>
          <div class="kpi-sub">ចំណាយទិញសម្ភារៈខែ {{ thisMonthKey.slice(5) }}</div>
        </div>
      </div>

      <div class="kpi">
        <div class="kpi-icon-wrap" style="background: rgba(126, 34, 206, 0.15); color: var(--purple);">
          <i class="fa-solid fa-arrow-trend-up"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-lbl">ដកប្រើប្រាស់ខែនេះ</div>
          <div class="kpi-val text-purple">{{ thisMonthUsageCount }} <span class="text-sm font-normal text-mu">លើក</span></div>
          <div class="kpi-sub">ផ្គត់ផ្គង់ដល់វគ្គផលិតកម្ម</div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- VIEW 1: MATERIALS CURRENT STOCK (បញ្ជីស្តុកបច្ចុប្បន្ន) -->
    <!-- ===================================================================== -->
    <div v-if="view === 'stock'" class="stock-view">
      <!-- Search & Filters -->
      <div class="card mb-3 no-print">
        <div class="filter-bar-grid">
          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-magnifying-glass"></i> ស្វែងរក</label>
            <input 
              v-model="searchMat" 
              type="text" 
              class="form-control" 
              placeholder="ឈ្មោះវត្ថុធាតុដើម ឬ អ្នកផ្គត់ផ្គង់..." 
            />
          </div>

          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-tags"></i> តាមប្រភេទ</label>
            <select v-model="filterCat" class="form-control">
              <option value="">-- គ្រប់ប្រភេទ --</option>
              <option v-for="c in MATERIAL_CATS" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div class="filter-item filter-btn-box d-flex gap-2">
            <button 
              :class="['btn btn-sm', filterAlertOnly ? 'btn-danger' : 'btn-outline']"
              @click="filterAlertOnly = !filterAlertOnly"
            >
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>តែជិតអស់ ({{ lowStockItems.length }})</span>
            </button>
            <button 
              v-if="searchMat || filterCat || filterAlertOnly" 
              class="btn btn-outline btn-sm" 
              @click="searchMat = ''; filterCat = ''; filterAlertOnly = false"
            >
              <i class="fa-solid fa-xmark"></i> សម្អាត
            </button>
          </div>
        </div>
      </div>

      <!-- Materials Stock Table -->
      <div class="card">
        <div class="card-head">
          <div>
            <h3><i class="fa-solid fa-boxes-stacked text-emerald"></i> បញ្ជីវត្ថុធាតុដើមក្នុងឃ្លាំង</h3>
            <span class="subtitle">បង្ហាញ {{ filteredMaterials.length }} មុខ | តម្លៃស្តុកសរុប៖ <b>{{ money(filteredMaterials.reduce((s, m) => s + ((+m.currentStock || 0) * (+m.unitCost || 0)), 0)) }}</b></span>
          </div>
          <button class="btn btn-primary btn-sm" @click="openAddMaterialModal">
            <i class="fa-solid fa-plus"></i> បន្ថែមមុខទំនិញថ្មី
          </button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ឈ្មោះវត្ថុធាតុដើម</th>
                <th>ប្រភេទ</th>
                <th class="text-right">ស្តុកបច្ចុប្បន្ន</th>
                <th class="text-right">កម្រិតរំលឹក</th>
                <th class="text-right">តម្លៃទិញជាមធ្យម</th>
                <th class="text-right">តម្លៃស្តុកសរុប</th>
                <th>ស្ថានភាព</th>
                <th>អ្នកផ្គត់ផ្គង់</th>
                <th class="text-center">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in filteredMaterials" :key="m.id">
                <td>
                  <div class="material-name-cell">
                    <span class="mat-icon-badge">
                      <i :class="m.cat.includes('មេផ្សិត') ? 'fa-solid fa-flask text-purple' : m.cat.includes('ថង់') ? 'fa-solid fa-box text-blue' : m.cat.includes('ស្រទាប់') ? 'fa-solid fa-tree text-amber' : 'fa-solid fa-cubes-stacked text-emerald'"></i>
                    </span>
                    <div>
                      <div class="font-bold text-tx">{{ m.name }}</div>
                      <div v-if="m.notes" class="text-xs text-mu truncate max-w-xs">{{ m.notes }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-cat">{{ m.cat }}</span>
                </td>
                <td class="text-right font-mono font-bold text-base" :class="(+m.currentStock || 0) <= (+m.minStock || 0) ? 'text-danger' : 'text-emerald'">
                  {{ fmt(m.currentStock) }} {{ m.unit }}
                </td>
                <td class="text-right font-mono text-mu">
                  {{ fmt(m.minStock) }} {{ m.unit }}
                </td>
                <td class="text-right font-mono text-mu">
                  {{ money(m.unitCost) }} / {{ m.unit }}
                </td>
                <td class="text-right font-mono font-bold text-blue">
                  {{ money((+m.currentStock || 0) * (+m.unitCost || 0)) }}
                </td>
                <td>
                  <span 
                    class="badge" 
                    :class="(+m.currentStock || 0) === 0 ? 'badge-out-stock' : (+m.currentStock || 0) <= (+m.minStock || 0) ? 'badge-low-stock' : 'badge-good-stock'"
                  >
                    <i :class="(+m.currentStock || 0) === 0 ? 'fa-solid fa-ban' : (+m.currentStock || 0) <= (+m.minStock || 0) ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-check'"></i>
                    {{ (+m.currentStock || 0) === 0 ? 'អស់ពីស្តុក' : (+m.currentStock || 0) <= (+m.minStock || 0) ? 'ជិតអស់' : 'គ្រប់គ្រាន់' }}
                  </span>
                </td>
                <td>
                  <span class="text-xs text-mu">{{ m.supplier || '-' }}</span>
                </td>
                <td class="text-center">
                  <div class="action-btn-group">
                    <button 
                      class="row-action-btn btn-stock-in" 
                      title="នាំចូលស្តុក (Stock In)"
                      @click="openStockInModal(m)"
                    >
                      <i class="fa-solid fa-arrow-down-to-bracket text-emerald"></i>
                    </button>
                    <button 
                      class="row-action-btn btn-stock-out" 
                      title="ដកប្រើប្រាស់ (Stock Out)"
                      @click="openStockOutModal(m)"
                    >
                      <i class="fa-solid fa-arrow-up-from-bracket text-amber"></i>
                    </button>
                    <button 
                      class="row-action-btn btn-view" 
                      title="មើលប្រវត្តិស្តុក (Stock Card)"
                      @click="openMaterialHistory(m)"
                    >
                      <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                    <button 
                      class="row-action-btn btn-edit" 
                      title="កែប្រែ"
                      @click="openEditMaterialModal(m)"
                    >
                      <i class="fa-solid fa-pen"></i>
                    </button>
                    <button 
                      class="row-action-btn btn-del" 
                      title="លុប"
                      @click="handleDeleteMaterial(m)"
                    >
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredMaterials.length === 0">
                <td colspan="9" class="text-center py-5 text-mu">
                  <i class="fa-solid fa-box-open text-3xl mb-2 opacity-50"></i>
                  <div>មិនមានវត្ថុធាតុដើមត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- VIEW 2: STOCK MOVEMENTS (កំណត់ត្រាចលនាស្តុក) -->
    <!-- ===================================================================== -->
    <div v-else-if="view === 'movements'" class="movements-view">
      <div class="card mb-3 no-print">
        <div class="filter-bar-grid">
          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-magnifying-glass"></i> ស្វែងរក</label>
            <input 
              v-model="searchMov" 
              type="text" 
              class="form-control" 
              placeholder="ឈ្មោះទំនិញ ឬ កំណត់សម្គាល់..." 
            />
          </div>

          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-arrow-right-arrow-left"></i> ប្រភេទចលនា</label>
            <select v-model="filterMovType" class="form-control">
              <option value="">-- ទាំងអស់ --</option>
              <option value="in">📥 នាំចូលស្តុក (Stock In)</option>
              <option value="out">📤 ដកប្រើប្រាស់ (Stock Out)</option>
            </select>
          </div>

          <div class="filter-item">
            <label class="filter-lbl"><i class="fa-solid fa-box"></i> តាមមុខទំនិញ</label>
            <select v-model="filterMovMat" class="form-control">
              <option value="">-- ទំនិញទាំងអស់ --</option>
              <option v-for="m in materialsList" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>

          <div class="filter-item filter-btn-box">
            <button 
              v-if="searchMov || filterMovType || filterMovMat" 
              class="btn btn-outline btn-sm" 
              @click="searchMov = ''; filterMovType = ''; filterMovMat = ''"
            >
              <i class="fa-solid fa-xmark"></i> សម្អាត
            </button>
          </div>
        </div>
      </div>

      <!-- Movements Table -->
      <div class="card">
        <div class="card-head">
          <div>
            <h3><i class="fa-solid fa-clock-rotate-left text-emerald"></i> ប្រវត្តិនាំចូល និងដកប្រើប្រាស់</h3>
            <span class="subtitle">បង្ហាញ {{ filteredMovements.length }} កំណត់ត្រា</span>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary btn-sm" @click="openStockInModal()">
              <i class="fa-solid fa-plus"></i> នាំចូលស្តុក
            </button>
            <button class="btn btn-outline btn-sm" @click="openStockOutModal()">
              <i class="fa-solid fa-minus text-amber"></i> ដកប្រើប្រាស់
            </button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>កាលបរិច្ឆេទ</th>
                <th>ប្រភេទ</th>
                <th>មុខទំនិញ</th>
                <th class="text-right">បរិមាណ</th>
                <th class="text-right">តម្លៃឯកតា</th>
                <th class="text-right">តម្លៃសរុប</th>
                <th>ភ្ជាប់វគ្គផ្សិត</th>
                <th>អ្នកផ្គត់ផ្គង់ / កំណត់សម្គាល់</th>
                <th class="text-center">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sm in filteredMovements" :key="sm.id">
                <td class="font-mono text-sm">{{ sm.date }}</td>
                <td>
                  <span class="badge" :class="sm.type === 'in' ? 'badge-stock-in' : 'badge-stock-out'">
                    <i :class="sm.type === 'in' ? 'fa-solid fa-arrow-down-to-bracket' : 'fa-solid fa-arrow-up-from-bracket'"></i>
                    {{ sm.type === 'in' ? 'នាំចូល' : 'ដកប្រើ' }}
                  </span>
                </td>
                <td><b>{{ sm.materialName }}</b></td>
                <td class="text-right font-mono font-bold" :class="sm.type === 'in' ? 'text-emerald' : 'text-amber'">
                  {{ sm.type === 'in' ? '+' : '-' }}{{ fmt(sm.qty) }} {{ sm.unit }}
                </td>
                <td class="text-right font-mono text-mu">{{ sm.unitCost ? money(sm.unitCost) : '-' }}</td>
                <td class="text-right font-mono font-bold" :class="sm.type === 'in' ? 'text-blue' : 'text-mu'">
                  {{ sm.totalCost ? money(sm.totalCost) : '-' }}
                </td>
                <td>
                  <span v-if="sm.batchId" class="badge badge-batch">{{ bname(sm.batchId) }}</span>
                  <span v-else class="text-xs text-mu">-</span>
                </td>
                <td>
                  <div>{{ sm.supplier || sm.note || '-' }}</div>
                  <div v-if="sm.supplier && sm.note" class="text-xs text-mu">{{ sm.note }}</div>
                </td>
                <td class="text-center">
                  <button class="row-action-btn btn-del" title="លុបកំណត់ត្រា" @click="handleDeleteMovement(sm)">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>

              <tr v-if="filteredMovements.length === 0">
                <td colspan="9" class="text-center py-5 text-mu">មិនមានកំណត់ត្រាចលនាស្តុកឡើយ</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- VIEW 3: INVENTORY ANALYTICS (ការវិភាគស្តុក) -->
    <!-- ===================================================================== -->
    <div v-else-if="view === 'analytics'" class="analytics-view">
      <div class="grid-2-col mb-4">
        <!-- Category Breakdown Card -->
        <div class="card">
          <div class="card-head">
            <h3><i class="fa-solid fa-chart-pie text-emerald"></i> ការបែងចែកតម្លៃស្តុកតាមប្រភេទ</h3>
            <span class="text-xs text-mu">ភាគរយ %</span>
          </div>

          <div class="cat-progress-list">
            <div v-for="c in catBreakdown" :key="c.cat" class="cat-progress-item mb-3">
              <div class="cat-header-row">
                <span><b>{{ c.cat }}</b> <small class="text-mu">({{ c.count }} មុខ)</small></span>
                <span class="font-mono font-bold">{{ money(c.value) }} <small class="text-mu">({{ c.pct }}%)</small></span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: c.pct + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Low Stock Summary Card -->
        <div class="card">
          <div class="card-head">
            <h3><i class="fa-solid fa-triangle-exclamation text-amber"></i> បញ្ជីវត្ថុធាតុដើមត្រូវទិញបន្ថែម</h3>
            <span class="text-xs text-danger font-bold">{{ lowStockItems.length }} មុខ</span>
          </div>

          <div class="low-stock-list">
            <div v-for="item in lowStockItems" :key="item.id" class="low-stock-item-row p-2 mb-2 border rounded-lg d-flex justify-between align-center">
              <div>
                <b class="text-tx">{{ item.name }}</b>
                <div class="text-xs text-mu">អ្នកផ្គត់ផ្គង់៖ {{ item.supplier || 'មិនកំណត់' }}</div>
              </div>
              <div class="text-right">
                <div class="text-danger font-bold">{{ item.currentStock }} / {{ item.minStock }} {{ item.unit }}</div>
                <button class="btn btn-primary btn-xs mt-1" @click="openStockInModal(item)">
                  <i class="fa-solid fa-plus"></i> ទិញចូល
                </button>
              </div>
            </div>

            <div v-if="lowStockItems.length === 0" class="text-center py-5 text-emerald">
              <i class="fa-solid fa-circle-check text-3xl mb-2"></i>
              <div>វត្ថុធាតុដើមទាំងអស់មានបរិមាណគ្រប់គ្រាន់ក្នុងស្តុក!</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- MODAL: ADD / EDIT MATERIAL -->
    <!-- ===================================================================== -->
    <div v-if="showMatModal" class="modal-backdrop" @click.self="showMatModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-boxes-stacked text-emerald"></i>
            {{ isEditingMat ? 'កែប្រែព័ត៌មានវត្ថុធាតុដើម' : 'បន្ថែមវត្ថុធាតុដើមថ្មី' }}
          </h3>
          <button class="icon-btn" @click="showMatModal = false"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form @submit.prevent="handleSaveMaterial">
          <div class="modal-body">
            <div class="form-group mb-3">
              <label class="label-text"><i class="fa-solid fa-box"></i> ឈ្មោះវត្ថុធាតុដើម / សម្ភារៈ *</label>
              <input v-model="matForm.name" type="text" class="form-control" placeholder="ឧ. មេផ្សិតចំបើង, ថង់ PP 12x24..." required />
            </div>

            <div class="grid-2-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-tags"></i> ប្រភេទ</label>
                <select v-model="matForm.cat" class="form-control">
                  <option v-for="c in MATERIAL_CATS" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-scale-balanced"></i> ឯកតារាប់</label>
                <select v-model="matForm.unit" class="form-control">
                  <option v-for="u in MATERIAL_UNITS" :key="u" :value="u">{{ u }}</option>
                </select>
              </div>
            </div>

            <div class="grid-3-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-cubes"></i> ស្តុកដំបូង</label>
                <input v-model.number="matForm.currentStock" type="number" step="any" class="form-control" placeholder="0" />
              </div>

              <div class="form-group">
                <label class="label-text text-amber"><i class="fa-solid fa-bell"></i> កម្រិតរំលឹក (Min)</label>
                <input v-model.number="matForm.minStock" type="number" step="any" class="form-control" placeholder="20" />
              </div>

              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-tag"></i> តម្លៃទិញ ({{ state.cur }})</label>
                <input v-model.number="matForm.unitCost" type="number" step="any" class="form-control" placeholder="1000" />
              </div>
            </div>

            <div class="form-group mb-3">
              <label class="label-text"><i class="fa-solid fa-truck"></i> អ្នកផ្គត់ផ្គង់ / ហាងទិញ</label>
              <input v-model="matForm.supplier" type="text" class="form-control" placeholder="ឧ. រោងម៉ាស៊ីនកិនស្រូវ, ផ្សារធំថ្មី..." />
            </div>

            <div class="form-group">
              <label class="label-text"><i class="fa-solid fa-note-sticky"></i> កំណត់សម្គាល់</label>
              <input v-model="matForm.notes" type="text" class="form-control" placeholder="លក្ខណៈបច្ចេកទេស ឬកន្លែងទុកដាក់..." />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showMatModal = false">បោះបង់</button>
            <button type="submit" class="btn btn-primary">
              <i class="fa-solid fa-check"></i> {{ isEditingMat ? 'រក្សាទុកការកែប្រែ' : 'បញ្ចូលមុខទំនិញ' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- MODAL: STOCK IN / STOCK OUT -->
    <!-- ===================================================================== -->
    <div v-if="showMovModal" class="modal-backdrop" @click.self="showMovModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3>
            <i :class="movType === 'in' ? 'fa-solid fa-arrow-down-to-bracket text-emerald' : 'fa-solid fa-arrow-up-from-bracket text-amber'"></i>
            {{ movType === 'in' ? 'នាំចូលស្តុក (Stock In)' : 'ដកប្រើប្រាស់ (Stock Out)' }}
          </h3>
          <button class="icon-btn" @click="showMovModal = false"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form @submit.prevent="handleSaveMovement">
          <div class="modal-body">
            <div class="form-group mb-3">
              <label class="label-text"><i class="fa-solid fa-box"></i> ជ្រើសរើសវត្ថុធាតុដើម *</label>
              <select v-model="movForm.materialId" class="form-control" required @change="onMovMaterialChange">
                <option value="" disabled>-- ជ្រើសរើសវត្ថុធាតុដើម --</option>
                <option v-for="m in materialsList" :key="m.id" :value="m.id">
                  {{ m.name }} (ស្តុកសល់: {{ m.currentStock }} {{ m.unit }})
                </option>
              </select>
            </div>

            <div class="grid-2-col mb-3">
              <div class="form-group">
                <label class="label-text"><i class="fa-solid fa-calendar-day"></i> កាលបរិច្ឆេទ *</label>
                <input v-model="movForm.date" type="date" class="form-control" required />
              </div>

              <div class="form-group">
                <label class="label-text font-bold" :class="movType === 'in' ? 'text-emerald' : 'text-amber'">
                  <i class="fa-solid fa-cubes"></i> បរិមាណ{{ movType === 'in' ? 'នាំចូល' : 'ដកប្រើ' }} *
                </label>
                <input v-model.number="movForm.qty" type="number" step="any" min="0.1" class="form-control" required @input="calculateMovTotal" />
              </div>
            </div>

            <!-- Price fields only for Stock In -->
            <template v-if="movType === 'in'">
              <div class="grid-2-col mb-3">
                <div class="form-group">
                  <label class="label-text"><i class="fa-solid fa-tag"></i> តម្លៃទិញក្នុង ១ ឯកតា ({{ state.cur }})</label>
                  <input v-model.number="movForm.unitCost" type="number" step="any" class="form-control" @input="calculateMovTotal" />
                </div>

                <div class="form-group">
                  <label class="label-text text-blue font-bold"><i class="fa-solid fa-calculator"></i> ទឹកប្រាក់សរុប ({{ state.cur }})</label>
                  <input v-model.number="movForm.totalCost" type="number" step="any" class="form-control" readonly />
                </div>
              </div>

              <div class="form-group mb-3">
                <label class="label-text"><i class="fa-solid fa-truck"></i> អ្នកផ្គត់ផ្គង់</label>
                <input v-model="movForm.supplier" type="text" class="form-control" placeholder="ឈ្មោះហាង ឬក្រុមហ៊ុន..." />
              </div>

              <div class="form-group mb-3">
                <label class="checkbox-label-box">
                  <input type="checkbox" v-model="movForm.syncToExpense" />
                  <span>កត់ត្រាការទិញនេះចូលក្នុងតារាង <b>ចំណាយ (Expenses)</b> ដោយស្វ័យប្រវត្តិ</span>
                </label>
              </div>
            </template>

            <!-- Batch selector for Stock Out -->
            <template v-else>
              <div class="form-group mb-3">
                <label class="label-text"><i class="fa-solid fa-layer-group"></i> យកទៅប្រើសម្រាប់វគ្គផ្សិត</label>
                <select v-model="movForm.batchId" class="form-control">
                  <option value="">-- ប្រើប្រាស់ទូទៅ (មិនចាត់វគ្គ) --</option>
                  <option v-for="b in state.batches" :key="b.id" :value="b.id">{{ b.code }} ({{ b.type }})</option>
                </select>
              </div>
            </template>

            <div class="form-group">
              <label class="label-text"><i class="fa-solid fa-note-sticky"></i> កំណត់សម្គាល់</label>
              <input v-model="movForm.note" type="text" class="form-control" :placeholder="movType === 'in' ? 'ឧ. ទិញថង់បន្ថែម...' : 'ឧ. ច្រកថង់បាន 1000 ថង់...'" />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showMovModal = false">បោះបង់</button>
            <button type="submit" class="btn" :class="movType === 'in' ? 'btn-primary' : 'btn-purple'">
              <i class="fa-solid fa-check"></i> {{ movType === 'in' ? 'កត់ត្រានាំចូលស្តុក' : 'កត់ត្រាដកប្រើប្រាស់' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- MODAL: ITEM STOCK CARD / HISTORY -->
    <!-- ===================================================================== -->
    <div v-if="showHistoryModal && selectedMatForHistory" class="modal-backdrop" @click.self="showHistoryModal = false">
      <div class="modal-card modal-lg">
        <div class="modal-header">
          <div>
            <h3><i class="fa-solid fa-clock-rotate-left text-emerald"></i> ប័ណ្ណតាមដានស្តុក (Stock Card)</h3>
            <span class="subtitle">{{ selectedMatForHistory.name }} | ស្តុកបច្ចុប្បន្ន៖ <b class="text-emerald">{{ selectedMatForHistory.currentStock }} {{ selectedMatForHistory.unit }}</b></span>
          </div>
          <button class="icon-btn" @click="showHistoryModal = false"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="modal-body modal-scroll">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>កាលបរិច្ឆេទ</th>
                  <th>ប្រភេទ</th>
                  <th class="text-right">បរិមាណ</th>
                  <th class="text-right">តម្លៃសរុប</th>
                  <th>វគ្គផ្សិត</th>
                  <th>កំណត់សម្គាល់</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in materialHistoryMovements" :key="h.id">
                  <td class="font-mono text-sm">{{ h.date }}</td>
                  <td>
                    <span class="badge" :class="h.type === 'in' ? 'badge-stock-in' : 'badge-stock-out'">
                      {{ h.type === 'in' ? '📥 នាំចូល' : '📤 ដកប្រើ' }}
                    </span>
                  </td>
                  <td class="text-right font-mono font-bold" :class="h.type === 'in' ? 'text-emerald' : 'text-amber'">
                    {{ h.type === 'in' ? '+' : '-' }}{{ fmt(h.qty) }} {{ h.unit }}
                  </td>
                  <td class="text-right font-mono">{{ h.totalCost ? money(h.totalCost) : '-' }}</td>
                  <td>{{ h.batchId ? bname(h.batchId) : '-' }}</td>
                  <td>{{ h.note || h.supplier || '-' }}</td>
                </tr>
                <tr v-if="materialHistoryMovements.length === 0">
                  <td colspan="6" class="text-center py-4 text-mu">មិនទាន់មានប្រវត្តិចលនាស្តុកសម្រាប់មុខទំនិញនេះឡើយ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="showHistoryModal = false">បិទ</button>
          <div class="d-flex gap-2">
            <button class="btn btn-primary btn-sm" @click="openStockInModal(selectedMatForHistory); showHistoryModal = false">
              <i class="fa-solid fa-plus"></i> នាំចូលស្តុក
            </button>
            <button class="btn btn-outline btn-sm" @click="openStockOutModal(selectedMatForHistory); showHistoryModal = false">
              <i class="fa-solid fa-minus text-amber"></i> ដកប្រើប្រាស់
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Header & Sub-Navigation Tabs */
.card-inv-header {
  padding: 22px 24px;
}

.header-main-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
}

.header-titles {
  flex: 1;
  min-width: 280px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header-actions-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.sub-nav-tabs {
  display: flex;
  gap: 10px;
  border-top: 1px solid var(--ln);
  padding-top: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.sub-tab-btn {
  background: var(--bg);
  border: 1px solid var(--ln);
  color: var(--mu);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  line-height: 1.5;
  white-space: nowrap;
}

.sub-tab-btn i {
  font-size: 14px;
  display: inline-block;
  line-height: 1;
}

.sub-tab-btn:hover {
  color: var(--tx);
  border-color: var(--ac);
  background: var(--card);
}

.sub-tab-btn.active {
  background: var(--ac);
  color: #ffffff;
  border-color: var(--ac);
  box-shadow: 0 2px 6px rgba(47, 125, 79, 0.35);
}

.filter-bar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  align-items: flex-end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-lbl {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--mu);
  display: flex;
  align-items: center;
  gap: 6px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.row-action-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--ln);
  background: var(--bg);
  color: var(--tx);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;
  font-size: 13px;
}

.row-action-btn:hover {
  border-color: var(--ac);
  color: var(--ac);
  background: var(--card);
}

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


.badge-low-alert {
  font-size: 12px;
  background: var(--bad-light);
  color: var(--bad);
  border: 1px solid rgba(229, 62, 62, 0.3);
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Low Stock Alert Banner */
.low-stock-banner {
  background: rgba(229, 62, 62, 0.08);
  border: 1.5px solid var(--bad);
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
}

.banner-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(229, 62, 62, 0.2);
  color: var(--bad);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.banner-body h4 {
  font-size: 15px;
  font-weight: 700;
  color: var(--bad);
  margin-bottom: 8px;
}

.low-items-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.low-item-chip {
  background: var(--card);
  border: 1px solid var(--bad);
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.low-item-chip:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.material-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mat-icon-badge {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--bg);
  border: 1px solid var(--ln);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}

.badge-cat {
  background: var(--bg);
  color: var(--mu);
  border: 1px solid var(--ln);
  font-size: 12px;
}

.badge-good-stock {
  background: var(--ac-light);
  color: var(--ac);
  border: 1px solid rgba(47, 125, 79, 0.2);
}

.badge-low-stock {
  background: var(--exp-light);
  color: var(--exp);
  border: 1px solid rgba(217, 119, 6, 0.3);
}

.badge-out-stock {
  background: var(--bad-light);
  color: var(--bad);
  border: 1px solid rgba(229, 62, 62, 0.3);
}

.badge-stock-in {
  background: var(--ac-light);
  color: var(--ac);
  border: 1px solid rgba(47, 125, 79, 0.2);
}

.badge-stock-out {
  background: var(--exp-light);
  color: var(--exp);
  border: 1px solid rgba(217, 119, 6, 0.2);
}

.row-action-btn.btn-stock-in:hover {
  background: var(--ac-light);
  border-color: var(--ac);
}

.row-action-btn.btn-stock-out:hover {
  background: var(--exp-light);
  border-color: var(--exp);
}

.cat-header-row {
  display: flex;
  justify-content: space-between;
  font-size: 13.5px;
  margin-bottom: 5px;
}
</style>
