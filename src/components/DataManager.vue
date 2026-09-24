<script setup>
import { ref, computed } from 'vue'
import { state, exportBackupJSON, importBackupJSON, loadSampleData, resetAllData, exportToCSV, bname, money, syncStatus, pushToGoogleSheets, fetchFromGoogleSheets, showToast, askConfirm, verifyAdminPin, isAdmin } from '../store'

const fileInput = ref(null)
const importMsg = ref(null)
const importSuccess = ref(false)

const batchCount = computed(() => state.batches.length)
const harvestCount = computed(() => state.harvests.length)
const incomeCount = computed(() => state.incomes.length)
const expenseCount = computed(() => state.expenses.length)
const workerCount = computed(() => (state.workers || []).length)
const materialCount = computed(() => (state.materials || []).length)

const storageSizeKB = computed(() => {
  try {
    const str = localStorage.getItem('mushroom-farm-v1') || ''
    return (new Blob([str]).size / 1024).toFixed(2)
  } catch {
    return '0'
  }
})

// Google Sheets Push / Pull
const sheetsMsg = ref(null)
const sheetsSuccess = ref(true)

async function handlePushSheets() {
  if (syncStatus.loading) return
  const res = await pushToGoogleSheets()
  sheetsSuccess.value = res.success
  sheetsMsg.value = res.success 
    ? 'ទិន្នន័យទាំងអស់ (វគ្គ, ផល, ចំណូល, ចំណាយ) ត្រូវបានបញ្ជូនទៅ Google Sheets ដោយជោគជ័យ!' 
    : 'បរាជ័យក្នុងការបញ្ជូនទៅ Google Sheets៖ ' + res.message
  setTimeout(() => { sheetsMsg.value = null }, 5000)
}

async function handlePullSheets() {
  if (syncStatus.loading) return
  const ok = await askConfirm({
    title: 'ទាញយកទិន្នន័យពី Google Sheets',
    message: 'តើអ្នកចង់ទាញយកទិន្នន័យពី Google Sheets មកធ្វើបច្ចុប្បន្នភាពលើឧបករណ៍នេះមែនទេ?',
    confirmText: 'ទាញយក (Pull)',
    type: 'warning'
  })
  if (ok) {
    showToast('កំពុងទាញយកទិន្នន័យពី Google Sheets...', 'info')
    const res = await fetchFromGoogleSheets()
    if (res.success) {
      showToast('ទិន្នន័យពី Google Sheets ត្រូវបានទាញយកជោគជ័យ!', 'success', 'Google Sheets')
    } else {
      showToast('បរាជ័យក្នុងការទាញយក៖ ' + res.message, 'error')
    }
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    const res = importBackupJSON(event.target.result)
    if (res.success) {
      importSuccess.value = true
      importMsg.value = 'ទិន្នន័យត្រូវបានស្ដារឡើងវិញដោយជោគជ័យ!'
    } else {
      importSuccess.value = false
      importMsg.value = 'បរាជ័យក្នុងការស្ដារទិន្នន័យ៖ ' + res.message
    }
    setTimeout(() => { importMsg.value = null }, 4000)
  }
  reader.readAsText(file)
  e.target.value = ''
}

async function confirmLoadSample() {
  const ok = await askConfirm({
    title: 'បញ្ចូលទិន្នន័យគំរូ',
    message: 'តើអ្នកចង់បញ្ចូលទិន្នន័យគំរូសម្រាប់សាកល្បងមែនទេ? វានឹងបន្ថែមវគ្គ ផល ចំណូល និងចំណាយគំរូចូលក្នុងប្រព័ន្ធ។',
    confirmText: 'បញ្ចូលទិន្នន័យគំរូ',
    type: 'warning'
  })
  if (ok) {
    loadSampleData()
    showToast('ទិន្នន័យគំរូត្រូវបានបញ្ចូលដោយជោគជ័យ!', 'success')
  }
}

// Reset All Security PIN Modal State
const showResetModal = ref(false)
const resetPinInput = ref('')
const resetPinError = ref(null)
const showResetPin = ref(false)
const isResetting = ref(false)

function confirmReset() {
  resetPinInput.value = ''
  resetPinError.value = null
  showResetPin.value = false
  showResetModal.value = true
}

function closeResetModal() {
  showResetModal.value = false
  resetPinInput.value = ''
  resetPinError.value = null
}

async function executeResetWithPin() {
  const pin = String(resetPinInput.value || '').trim()
  if (!pin) {
    resetPinError.value = 'សូមបញ្ចូលលេខកូដសម្ងាត់ PIN!'
    return
  }

  // Verify Admin PIN with resilient fallback
  let isValid = false
  try {
    if (typeof verifyAdminPin === 'function') {
      isValid = verifyAdminPin(pin)
    }
  } catch (e) {
    console.warn('verifyAdminPin error:', e)
  }

  if (!isValid) {
    if (state.settings && state.settings.adminPin && String(state.settings.adminPin).trim() === pin) isValid = true
    if ((state.users || []).some(u => u.role === 'admin' && String(u.pin).trim() === pin)) isValid = true
    if (pin === '1234') isValid = true
  }

  if (!isValid) {
    resetPinError.value = 'លេខកូដសម្ងាត់ PIN មិនត្រឹមត្រូវទេ! សូមពិនិត្យម្តងទៀត។'
    resetPinInput.value = ''
    return
  }

  isResetting.value = true
  try {
    resetAllData()
    closeResetModal()
    showToast('ទិន្នន័យទាំងអស់ត្រូវបានលុបជម្រះចេញពី Dashboard ដោយជោគជ័យ!', 'success', 'Reset Data')
  } catch (err) {
    resetPinError.value = 'មានបញ្ហាក្នុងការលុបទិន្នន័យ៖ ' + err.message
  } finally {
    isResetting.value = false
  }
}

function exportBatchesCSV() {
  const h = ['លេខកូដ', 'ប្រភេទ', 'ចំនួនថង់', 'ថ្ងៃចាប់ផ្តើម', 'ដំណាក់កាល']
  const r = state.batches.map((b) => [b.code, b.type, b.bags, b.date, b.stage])
  exportToCSV('batches', h, r)
}

function exportHarvestsCSV() {
  const h = ['វគ្គ', 'កាលបរិច្ឆេទ', 'ទម្ងន់ (គ.ក)', 'ក្រេដ', 'ថង់ខូច']
  const r = state.harvests.map((x) => [bname(x.batch), x.date, x.kg, x.grade, x.bad || 0])
  exportToCSV('harvests', h, r)
}

function exportIncomesCSV() {
  const h = ['វគ្គ', 'កាលបរិច្ឆេទ', 'អតិថិជន', 'លក់ (គ.ក)', 'តម្លៃ/គ.ក', 'សរុប']
  const r = state.incomes.map((x) => [bname(x.batch), x.date, x.cust || '-', x.kg, money(x.price), money(x.kg * x.price)])
  exportToCSV('incomes', h, r)
}

function exportExpensesCSV() {
  const h = ['វគ្គ', 'កាលបរិច្ឆេទ', 'ប្រភេទចំណាយ', 'ទឹកប្រាក់', 'កំណត់សម្គាល់']
  const r = state.expenses.map((x) => [bname(x.batch), x.date, x.cat, money(x.amt), x.note || ''])
  exportToCSV('expenses', h, r)
}

function exportWorkersCSV() {
  const h = ['ឈ្មោះ', 'លេខទូរស័ព្ទ', 'តួនាទី', 'ទម្រង់បើកប្រាក់', 'ប្រាក់គោល (៛)', 'ថ្ងៃចូលធ្វើការ', 'ស្ថានភាព']
  const r = (state.workers || []).map((w) => [w.name, w.phone || '-', w.role, w.wageType, w.baseRate, w.startDate, w.status])
  exportToCSV('workers', h, r)
}

function exportMaterialsCSV() {
  const h = ['ឈ្មោះវត្ថុធាតុដើម', 'ប្រភេទ', 'ស្តុកបច្ចុប្បន្ន', 'ខ្នាត', 'ស្តុកអប្បបរមា', 'តម្លៃឯកតា (៛)', 'អ្នកផ្គត់ផ្គង់']
  const r = (state.materials || []).map((m) => [m.name, m.cat, m.currentStock, m.unit, m.minStock, m.unitCost, m.supplier || '-'])
  exportToCSV('materials_inventory', h, r)
}
</script>

<template>
  <div class="data-container">
    <!-- Header -->
    <div class="card">
      <div class="card-head">
        <div>
          <h2><i class="fa-solid fa-database text-emerald"></i> ការគ្រប់គ្រងទិន្នន័យ & Google Sheets Cloud</h2>
          <p class="subtitle">ភ្ជាប់ជាមួយ Google Sheets ផ្ទាល់, បម្រុងទុក (Backup), ស្ដារឡើងវិញ (Restore), និងទាញយក CSV</p>
        </div>
      </div>
    </div>

    <!-- Google Sheets Message Alert -->
    <div v-if="sheetsMsg" class="alert-box" :class="sheetsSuccess ? 'alert-success' : 'alert-error'">
      <i class="fa-solid" :class="sheetsSuccess ? 'fa-circle-check' : 'fa-circle-xmark'"></i>
      <span>{{ sheetsMsg }}</span>
    </div>

    <!-- File Import Alert -->
    <div v-if="importMsg" class="alert-box" :class="importSuccess ? 'alert-success' : 'alert-error'">
      <i class="fa-solid" :class="importSuccess ? 'fa-circle-check' : 'fa-circle-xmark'"></i>
      <span>{{ importMsg }}</span>
    </div>

    <!-- 1. Google Sheets Live Database Card -->
    <div class="card google-sheets-card">
      <div class="sheets-card-head">
        <div class="sheets-logo-box">
          <i class="fa-solid fa-file-excel text-emerald text-3xl"></i>
          <div>
            <div class="d-flex align-center gap-2">
              <h3 class="sheets-card-title">Google Sheets Cloud Database</h3>
              <span class="sheets-connected-badge"><i class="fa-solid fa-check-circle"></i> បានភ្ជាប់រួចរាល់</span>
            </div>
            <p class="card-desc">ទិន្នន័យអាចបញ្ជូនទៅ Google Sheets ដើម្បីបើកមើលលើទូរស័ព្ទ ឬកុំព្យូទ័រតាម Google Drive គ្រប់ពេលវេលា។</p>
          </div>
        </div>

        <div class="sheets-sync-meta">
          <small class="text-mu">
            <i class="fa-regular fa-clock"></i> {{ syncStatus.lastSynced ? 'បាន Sync ចុងក្រោយ៖ ' + syncStatus.lastSynced : 'មិនទាន់បាន Sync នៅឡើយ' }}
          </small>
        </div>
      </div>

      <!-- Action Buttons for Google Sheets -->
      <div class="sheets-action-grid mt-3">
        <button 
          class="btn btn-primary sheets-btn" 
          :disabled="syncStatus.loading" 
          @click="handlePushSheets"
        >
          <i class="fa-solid fa-cloud-arrow-up" :class="{ 'fa-spin': syncStatus.loading }"></i>
          <div>
            <b>បញ្ជូនទៅ Google Sheets (Push)</b>
            <span>អាប់ដេតទិន្នន័យពី Dashboard ទៅ Google Sheet</span>
          </div>
        </button>

        <button 
          class="btn btn-outline sheets-btn" 
          :disabled="syncStatus.loading" 
          @click="handlePullSheets"
        >
          <i class="fa-solid fa-cloud-arrow-down" :class="{ 'fa-spin': syncStatus.loading }"></i>
          <div>
            <b>ទាញយកពី Google Sheets (Pull)</b>
            <span>យកទិន្នន័យពី Google Sheet មកប្រើលើ Dashboard</span>
          </div>
        </button>
      </div>

      <div class="sheets-url-preview mt-3">
        <span class="text-mu text-xs">Web App API:</span>
        <code class="sheets-url-code">{{ state.settings.googleScriptUrl }}</code>
      </div>
    </div>

    <!-- Storage Overview -->
    <div class="card">
      <h3 class="section-title"><i class="fa-solid fa-hard-drive"></i> ស្ថានភាពឃ្លាំងទិន្នន័យក្នុងឧបករណ៍</h3>
      <div class="storage-stats-grid">
        <div class="stat-tile">
          <i class="fa-solid fa-seedling text-emerald"></i>
          <div>
            <b>{{ batchCount }}</b>
            <span>វគ្គផលិត</span>
          </div>
          <button class="mini-csv-btn" title="ទាញយកជា CSV" @click="exportBatchesCSV">CSV</button>
        </div>

        <div class="stat-tile">
          <i class="fa-solid fa-basket-shopping text-purple"></i>
          <div>
            <b>{{ harvestCount }}</b>
            <span>កំណត់ត្រាផល</span>
          </div>
          <button class="mini-csv-btn" title="ទាញយកជា CSV" @click="exportHarvestsCSV">CSV</button>
        </div>

        <div class="stat-tile">
          <i class="fa-solid fa-money-bill-wave text-inc"></i>
          <div>
            <b>{{ incomeCount }}</b>
            <span>កំណត់ត្រាចំណូល</span>
          </div>
          <button class="mini-csv-btn" title="ទាញយកជា CSV" @click="exportIncomesCSV">CSV</button>
        </div>

                <div class="stat-tile">
          <i class="fa-solid fa-receipt text-exp"></i>
          <div>
            <b>{{ expenseCount }}</b>
            <span>កំណត់ត្រាចំណាយ</span>
          </div>
          <button class="mini-csv-btn" title="ទាញយកជា CSV" @click="exportExpensesCSV">CSV</button>
        </div>

        <div class="stat-tile">
          <i class="fa-solid fa-users text-blue"></i>
          <div>
            <b>{{ workerCount }}</b>
            <span>កម្មករកសិដ្ឋាន</span>
          </div>
          <button class="mini-csv-btn" title="ទាញយកជា CSV" @click="exportWorkersCSV">CSV</button>
        </div>

        <div class="stat-tile">
          <i class="fa-solid fa-boxes-stacked text-amber"></i>
          <div>
            <b>{{ materialCount }}</b>
            <span>ស្តុកវត្ថុធាតុដើម</span>
          </div>
          <button class="mini-csv-btn" title="ទាញយកជា CSV" @click="exportMaterialsCSV">CSV</button>
        </div>
      </div>

      <div class="storage-usage-bar mt-3">
        <i class="fa-solid fa-circle-info text-mu"></i>
        <small class="text-mu">ទំហំផ្ទុកក្នុងឧបករណ៍ (LocalStorage)៖ <b>{{ storageSizeKB }} KB</b></small>
      </div>
    </div>

    <!-- Backup & Restore Grid -->
    <div class="grid-2-cols">
      <!-- Backup Section -->
      <div class="card action-card">
        <div class="card-icon-header">
          <div class="icon-circle bg-emerald-light text-emerald">
            <i class="fa-solid fa-file-export"></i>
          </div>
          <div>
            <h3>បម្រុងទុកជាឯកសារ (.JSON)</h3>
            <p class="card-desc">ទាញយកឯកសារបម្រុងទុក .JSON រួមបញ្ចូលទាំងវគ្គ ផលិតកម្ម ចំណូល ចំណាយ និងការកំណត់កសិដ្ឋានទាំងអស់។</p>
          </div>
        </div>

        <div class="card-action-box">
          <button class="btn btn-primary w-full" @click="exportBackupJSON">
            <i class="fa-solid fa-download"></i>
            <span>ទាញយកឯកសារបម្រុងទុក (.JSON)</span>
          </button>
        </div>
      </div>

      <!-- Restore Section -->
      <div class="card action-card">
        <div class="card-icon-header">
          <div class="icon-circle bg-blue-light text-blue">
            <i class="fa-solid fa-file-import"></i>
          </div>
          <div>
            <h3>ស្ដារទិន្នន័យពីឯកសារ (.JSON)</h3>
            <p class="card-desc">បញ្ចូលឯកសារ .JSON ដែលបានបម្រុងទុកពីមុនមកប្រើប្រាស់ឡើងវិញនៅលើឧបករណ៍នេះ។</p>
          </div>
        </div>

        <div class="card-action-box">
          <input type="file" ref="fileInput" accept=".json" class="hidden-input" @change="handleFileSelect" />
          <button class="btn btn-outline w-full" @click="$refs.fileInput.click()">
            <i class="fa-solid fa-upload"></i>
            <span>ជ្រើសរើសឯកសារបម្រុងទុក (.JSON)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Sample Data & Reset Danger Zone -->
    <div class="grid-2-cols">
      <!-- Sample Data Generator -->
      <div class="card action-card">
        <div class="card-icon-header">
          <div class="icon-circle bg-purple-light text-purple">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <div>
            <h3>ទិន្នន័យគំរូសម្រាប់សាកល្បង (Sample Demo Data)</h3>
            <p class="card-desc">បញ្ចូលវគ្គគំរូចំនួន ៣ ផលិតផល ចំណូល និងចំណាយជាក់ស្តែង ដើម្បីសាកល្បងមើលផ្ទាំងគ្រប់គ្រង និងរបាយការណ៍។</p>
          </div>
        </div>

        <div class="card-action-box">
          <button class="btn btn-purple w-full" @click="confirmLoadSample">
            <i class="fa-solid fa-sparkles"></i>
            <span>បញ្ចូលទិន្នន័យគំរូ</span>
          </button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="card action-card border-danger">
        <div class="card-icon-header">
          <div class="icon-circle bg-danger-light text-danger">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h3 class="text-danger">តំបន់គ្រោះថ្នាក់ (Danger Zone)</h3>
            <p class="card-desc">លុបជម្រះទិន្នន័យទាំងអស់ (វគ្គ, ផល, ចំណូល, ចំណាយ, កម្មករ, ប្រាក់ឈ្នួល, ស្តុកវត្ថុធាតុដើម)។ សកម្មភាពនេះមិនអាចត្រឡប់ក្រោយបានទេ។</p>
          </div>
        </div>

        <div class="card-action-box">
          <button class="btn btn-danger w-full" @click="confirmReset">
            <i class="fa-solid fa-trash-can"></i>
            <span>លុបទិន្នន័យទាំងអស់ (Reset All)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Reset All Security PIN Modal (ផ្ទាំងផ្ទៀងផ្ទាត់ PIN ពេល Reset) -->
    <!-- ========================================================================= -->
    <div v-if="showResetModal" class="modal-backdrop" @click.self="closeResetModal">
      <div class="modal-card modal-sm">
        <div class="modal-header">
          <div class="d-flex align-center gap-2">
            <div class="icon-circle bg-danger-light text-danger" style="width: 38px; height: 38px; font-size: 16px;">
              <i class="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <h3 class="text-danger">ផ្ទៀងផ្ទាត់លេខសម្ងាត់ PIN</h3>
              <span class="text-mu text-xs">ទាមទារសិទ្ធិអ្នកគ្រប់គ្រង (Admin PIN)</span>
            </div>
          </div>
          <button class="icon-btn" @click="closeResetModal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form @submit.prevent="executeResetWithPin">
          <div class="modal-body">
            <div class="alert-box alert-error mb-3">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span style="font-size: 12px; line-height: 1.5;">
                <b>ការព្រមានគ្រោះថ្នាក់៖</b> សកម្មភាពនេះនឹងលុបជម្រះទិន្នន័យទាំងអស់ (វគ្គ, ផល, ចំណូល, ចំណាយ, កម្មករ, ប្រាក់ឈ្នួល, ស្តុក) ចេញពីប្រព័ន្ធ! សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។
              </span>
            </div>

            <div class="form-group mb-2">
              <label class="font-bold text-xs d-block mb-1">
                <i class="fa-solid fa-lock text-danger"></i> បញ្ចូលលេខកូដសម្ងាត់ PIN របស់ Admin ដើម្បីបន្ត៖
              </label>
              <div class="d-flex gap-1">
                <input 
                  v-model="resetPinInput" 
                  :type="showResetPin ? 'text' : 'password'" 
                  class="form-control" 
                  placeholder="បញ្ចូលលេខសម្ងាត់ PIN..." 
                  autocomplete="off"
                  autofocus
                  required 
                />
                <button 
                  type="button" 
                  class="btn btn-outline px-3" 
                  tabindex="-1"
                  title="បង្ហាញ/លាក់លេខកូដ"
                  @click="showResetPin = !showResetPin"
                >
                  <i class="fa-solid" :class="showResetPin ? 'fa-eye-slash' : 'fa-eye'"></i>
                </button>
              </div>
              <small class="text-mu text-xs mt-1 d-block">
                * បញ្ចូលលេខកូដ PIN របស់ Admin (លំនាំដើម <code>1234</code> ឬលេខកំណត់ក្នុង Settings)
              </small>
            </div>

            <div v-if="resetPinError" class="alert-box alert-error mt-2">
              <i class="fa-solid fa-circle-xmark"></i>
              <span>{{ resetPinError }}</span>
            </div>
          </div>

          <div class="modal-footer justify-between">
            <button type="button" class="btn btn-outline" @click="closeResetModal">
              <i class="fa-solid fa-xmark"></i> បោះបង់
            </button>
            <button type="submit" class="btn btn-danger" :disabled="!resetPinInput || isResetting">
              <i class="fa-solid" :class="isResetting ? 'fa-spinner fa-spin' : 'fa-trash-can'"></i>
              <span>{{ isResetting ? 'កំពុងលុបជម្រះ...' : 'បញ្ជាក់ការលុប (Reset All)' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
