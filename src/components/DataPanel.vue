<script setup>
import { reactive, computed, ref } from 'vue'
import { state, FIELDS, STAGES, uid, fmt, money, bname, removeBatch, isAdmin, syncStatus, sum, sale, showToast, askConfirm } from '../store'
import SalesReceiptModal from './SalesReceiptModal.vue'

const props = defineProps({ t: String })
const fields = FIELDS[props.t]
const today = () => new Date().toISOString().slice(0, 10)
const blank = () => Object.fromEntries(fields.map(([k, , ty, o]) => [k, ty === 'date' ? today() : ty === 'sel' ? o[0] : ty === 'num' ? null : '']))
const draft = reactive(blank())

// Reactive check if batch selection is required
const needBatch = computed(() => props.t !== 'batches' && props.t !== 'expenses' && !state.batches.length)

const rows = computed(() => {
  const r = [...state[props.t]]
  return props.t === 'batches' ? r : r.sort((a, b) => (a.date < b.date ? 1 : -1))
})

// Modals State
const showDetailsModal = ref(false)
const showEditModal = ref(false)
const selectedItem = ref(null)
const editDraft = ref({})

// Receipt / Invoice Generator State
const showReceiptModal = ref(false)
const receiptItem = ref(null)

function openReceipt(item) {
  receiptItem.value = item
  showReceiptModal.value = true
}

function add() {
  const rec = { id: uid() }
  for (const [k, , ty] of fields) {
    let v = draft[k]
    if (ty === 'num') v = +v || 0
    if (ty === 'batch') { if (!v) return; v = +v }
    if (ty === 'batchg') v = v === '' ? '' : +v
    if (ty === 'text' && k === 'code' && !v) return
    rec[k] = v
  }
  state[props.t].push(rec)
  Object.assign(draft, blank())
  showToast('បានកត់ត្រាទិន្នន័យថ្មីដោយជោគជ័យ!', 'success', tabTitleKhmer.value)
}

async function del(r) {
  if (!isAdmin.value) {
    showToast('ការលុបទិន្នន័យត្រូវបានអនុញ្ញាតសម្រាប់តែ Admin ប៉ុណ្ណោះ!', 'warning', 'ទាមទារ Admin')
    return
  }

  if (props.t === 'batches') {
    const ok = await askConfirm({
      title: 'លុបវគ្គផលិតកម្ម',
      message: `តើអ្នកពិតជាចង់លុបវគ្គ "${r.code}" និងទិន្នន័យផល ចំណូល ចំណាយពាក់ព័ន្ធទាំងអស់មែនទេ?`,
      confirmText: 'លុបវគ្គនេះ',
      type: 'danger'
    })
    if (ok) {
      removeBatch(r.id)
      if (showDetailsModal.value) showDetailsModal.value = false
      showToast(`បានលុបវគ្គ "${r.code}" រួចរាល់`, 'info')
    }
  } else {
    const ok = await askConfirm({
      title: 'លុបកំណត់ត្រា',
      message: 'តើអ្នកពិតជាចង់លុបជួរដេកនេះមែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។',
      confirmText: 'លុប',
      type: 'danger'
    })
    if (ok) {
      state[props.t] = state[props.t].filter((x) => x.id !== r.id)
      if (showDetailsModal.value) showDetailsModal.value = false
      showToast('បានលុបកំណត់ត្រាជោគជ័យ', 'info')
    }
  }
}

// Details Modal
function openDetails(r) {
  selectedItem.value = r
  showDetailsModal.value = true
}

// Edit Modal
function openEdit(r) {
  editDraft.value = JSON.parse(JSON.stringify(r))
  showEditModal.value = true
}

function saveEdit() {
  const idx = state[props.t].findIndex((x) => x.id === editDraft.value.id)
  if (idx !== -1) {
    for (const [k, , ty] of fields) {
      if (ty === 'num') editDraft.value[k] = +editDraft.value[k] || 0
      if (ty === 'batch') editDraft.value[k] = +editDraft.value[k]
      if (ty === 'batchg') editDraft.value[k] = editDraft.value[k] === '' ? '' : +editDraft.value[k]
    }
    state[props.t][idx] = { ...editDraft.value }
    if (selectedItem.value && selectedItem.value.id === editDraft.value.id) {
      selectedItem.value = { ...editDraft.value }
    }
    showEditModal.value = false
    showToast('ទិន្នន័យត្រូវបានកែប្រែ និងរក្សាទុកជោគជ័យ!', 'success', 'កែប្រែរួចរាល់')
  }
}

// Batch Analytics Computed for Details Modal
const batchStats = computed(() => {
  if (props.t !== 'batches' || !selectedItem.value) return null
  const b = selectedItem.value
  const kg = sum(state.harvests.filter((x) => x.batch === b.id), 'kg')
  const bad = sum(state.harvests.filter((x) => x.batch === b.id), 'bad')
  const inc = state.incomes.filter((x) => x.batch === b.id).reduce((t, x) => t + sale(x), 0)
  const exp = sum(state.expenses.filter((x) => x.batch === b.id), 'amt')
  const profit = inc - exp
  const badPct = b.bags ? ((bad / b.bags) * 100).toFixed(1) : 0
  const perBag = b.bags ? +(kg / b.bags).toFixed(2) : 0
  const perBagKham = b.bags ? +((kg / b.bags) * 10).toFixed(2) : 0
  const cost = kg ? Math.round(exp / kg) : null
  const harvests = state.harvests.filter((x) => x.batch === b.id)
  const sales = state.incomes.filter((x) => x.batch === b.id)
  return { kg, bad, inc, exp, profit, badPct, perBag, perBagKham, cost, harvests, sales }
})

const show = (f, r) => {
  const [k, , ty] = f
  if (ty === 'batch' || ty === 'batchg') return bname(r[k])
  if (k === 'price' || k === 'amt') return money(r[k])
  if (ty === 'num') return fmt(r[k])
  return r[k]
}


function stageClass(s) {
  switch (s) {
    case 'ត្រៀមសម្ភារៈ': return 'prep'
    case 'ក្រៀលមេរោគ': return 'sterilize'
    case 'ដាក់មេ': return 'inoculate'
    case 'លូតលាស់មេ': return 'colonize'
    case 'ចេញផ្សិត': return 'pinning'
    case 'ប្រមូលផល': return 'harvest'
    case 'បញ្ចប់': return 'complete'
    default: return 'default'
  }
}

const tabTitleKhmer = computed(() => {
  const map = {
    batches: 'វគ្គផលិតកម្មផ្សិត',
    harvests: 'កំណត់ត្រាផលប្រមូលបាន',
    incomes: 'កំណត់ត្រាចំណូលពីការលក់',
    expenses: 'កំណត់ត្រាចំណាយកសិដ្ឋាន'
  }
  return map[props.t] || props.t
})
</script>

<template>
  <section class="card form-card">
    <div class="card-head">
      <h3>
        <i class="fa-solid fa-pen-to-square"></i>
        <span>បញ្ចូលទិន្នន័យថ្មី</span>
      </h3>
      <div class="d-flex align-center gap-2">
        <span v-if="syncStatus.loading" class="sync-active-badge">
          <i class="fa-solid fa-arrows-rotate fa-spin"></i> កំពុង Sync...
        </span>
        <span v-else-if="state.settings.autoSync" class="sync-ready-badge" title="រាល់ទិន្នន័យដែលបញ្ចូល នឹងឡើង Google Sheets ស្វ័យប្រវត្តិ">
          <i class="fa-solid fa-cloud-check text-emerald"></i> Auto-Sync ON
        </span>
        <span v-if="!isAdmin" class="user-mode-hint">
          <i class="fa-solid fa-shield-cat"></i> User Mode
        </span>
      </div>
    </div>

    <!-- Alert if no batches exist yet -->
    <div v-if="needBatch" class="alert-box">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <div>
        <strong>មិនទាន់មានវគ្គនៅឡើយទេ</strong>
        <p>សូមចូលទៅផ្ទាំង «វគ្គ» ដើម្បីបង្កើតវគ្គផ្សិតដំបូងសិន មុននឹងបញ្ចូលទិន្នន័យនេះ។</p>
      </div>
    </div>

    <!-- Data Entry Form -->
    <form v-else class="form-grid" @submit.prevent="add">
      <div v-for="f in fields" :key="f[0]" class="form-group">
        <label>
          <span class="label-text">
            <i v-if="f[4]" :class="f[4]"></i>
            {{ f[1] }}
          </span>

          <select v-if="f[2] === 'sel'" v-model="draft[f[0]]" class="form-control">
            <option v-for="o in f[3]" :key="o">{{ o }}</option>
          </select>

          <select v-else-if="f[2] === 'batch' || f[2] === 'batchg'" v-model="draft[f[0]]" class="form-control" required>
            <option v-if="f[2] === 'batchg'" value="">ទូទៅ (មិនចាត់វគ្គ)</option>
            <option v-else value="" disabled>-- ជ្រើសរើសវគ្គ --</option>
            <option v-for="b in state.batches" :key="b.id" :value="b.id">{{ b.code }} ({{ b.type }})</option>
          </select>

          <input 
            v-else 
            v-model="draft[f[0]]" 
            :type="f[2] === 'num' ? 'number' : f[2]" 
            :step="f[2] === 'num' ? 'any' : null" 
            :min="f[2] === 'num' ? 0 : null" 
            :required="!['note', 'cust'].includes(f[0])" 
            class="form-control"
            :placeholder="`បញ្ចូល ${f[1]}...`"
          />
        </label>
      </div>

      <div class="form-action">
        <button class="add-btn">
          <i class="fa-solid fa-circle-plus"></i>
          <span>បន្ថែមទិន្នន័យ</span>
        </button>
      </div>
    </form>
  </section>

  <!-- Records Table Card -->
  <section class="card table-card">
    <div class="card-head">
      <h3>
        <i class="fa-solid fa-list-ul"></i>
        <span>បញ្ជីទិន្នន័យ ({{ rows.length }})</span>
      </h3>
      <span class="text-hint"><i class="fa-solid fa-arrows-left-right"></i> អូសដើម្បីមើលបន្ថែម</span>
    </div>

    <div class="scroll-table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="(f, i) in fields" :key="f[0]" :class="[{ r: f[2] === 'num' }, { 'sticky-col': i === 0 }]">
              <i v-if="f[4]" :class="f[4]"></i>
              {{ f[1] }}
            </th>
            <th v-if="t === 'incomes'" class="r">
              <i class="fa-solid fa-calculator"></i>
              សរុប
            </th>
            <th class="action-col-header text-center">សកម្មភាព</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td v-for="(f, i) in fields" :key="f[0]" :class="[{ r: f[2] === 'num' }, { 'sticky-col': i === 0 }]">
              <!-- Inline stage selector for batches table -->
              <select v-if="t === 'batches' && f[0] === 'stage'" v-model="r.stage" :class="['stage-select', 'stage-' + stageClass(r.stage)]">
                <option v-for="s in STAGES" :key="s">{{ s }}</option>
              </select>

              <template v-else>
                <span v-if="f[0] === 'code'" class="font-bold clickable-link" @click="openDetails(r)">
                  <i class="fa-solid fa-circle-info text-xs text-emerald"></i> {{ r[f[0]] }}
                </span>
                <span v-else-if="f[0] === 'saleType'" class="badge" :class="r.saleType === 'លក់រាយ' ? 'badge-retail' : 'badge-wholesale'">
                  <i :class="r.saleType === 'លក់រាយ' ? 'fa-solid fa-basket-shopping' : 'fa-solid fa-boxes-packing'"></i>
                  {{ r.saleType || 'លក់ដុំ' }}
                </span>
                <span v-else-if="f[0] === 'amt' || f[0] === 'price'" :class="t === 'incomes' ? 'text-inc' : 'text-exp'">{{ show(f, r) }}</span>
                <template v-else>{{ show(f, r) }}</template>
              </template>
            </td>

            <td v-if="t === 'incomes'" class="r font-bold text-inc">
              {{ money(r.kg * r.price) }}
            </td>

            <!-- Action Buttons: View Details, Edit, Delete -->
            <td class="action-col text-center">
              <div class="action-btn-group">
                <!-- Receipt / Invoice Button for Incomes -->
                <button 
                  v-if="t === 'incomes'"
                  class="row-action-btn btn-receipt" 
                  title="ចេញវិក្កយបត្រលក់ (Print Invoice / Receipt)" 
                  @click="openReceipt(r)"
                >
                  <i class="fa-solid fa-receipt text-emerald"></i>
                </button>

                <!-- Details Button -->
                <button 
                  class="row-action-btn btn-view" 
                  title="មើលព័ត៌មានលម្អិត (View Details)" 
                  @click="openDetails(r)"
                >
                  <i class="fa-solid fa-eye"></i>
                </button>

                <!-- Edit Button -->
                <button 
                  class="row-action-btn btn-edit" 
                  title="កែប្រែទិន្នន័យ (Edit Item)" 
                  @click="openEdit(r)"
                >
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>

                <!-- Delete Button -->
                <button 
                  class="row-action-btn btn-del" 
                  :class="{ 'opacity-50': !isAdmin }"
                  :title="isAdmin ? 'លុបជួរដេកនេះ' : 'ទាមទារសិទ្ធិ Admin ដើម្បីលុប'" 
                  @click="del(r)"
                >
                  <i class="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="!rows.length">
            <td :colspan="fields.length + (t === 'incomes' ? 2 : 1)" class="table-empty">
              <i class="fa-solid fa-folder-open"></i>
              <span>មិនទាន់មានទិន្នន័យនៅឡើយទេ។ សូមបំពេញទម្រង់ខាងលើដើម្បីបន្ថែម។</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- ========================================================================= -->
  <!-- 1. DETAILS MODAL (ផ្ទាំងមើលព័ត៌មានលម្អិត) -->
  <!-- ========================================================================= -->
  <div v-if="showDetailsModal && selectedItem" class="modal-backdrop" @click.self="showDetailsModal = false">
    <div class="modal-card modal-lg">
      <div class="modal-header">
        <div class="d-flex align-center gap-2">
          <div class="icon-circle bg-emerald-light text-emerald" style="width: 38px; height: 38px; font-size: 16px;">
            <i class="fa-solid fa-circle-info"></i>
          </div>
          <div>
            <h3>ព័ត៌មានលម្អិត៖ {{ selectedItem.code || tabTitleKhmer }}</h3>
            <span class="text-mu text-xs">ID: {{ selectedItem.id }}</span>
          </div>
        </div>
        <button class="icon-btn" @click="showDetailsModal = false">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="modal-body modal-scroll">
        <!-- If it is a BATCH: Show Complete Analytics & History -->
        <template v-if="t === 'batches' && batchStats">
          <div class="details-badges-row mb-3">
            <span class="tag tag-lg"><i class="fa-solid fa-cubes-stacked"></i> ប្រភេទ៖ <b>{{ selectedItem.type }}</b></span>
            <span class="stage-tag tag-lg"><i class="fa-solid fa-bars-progress"></i> ដំណាក់កាល៖ <b>{{ selectedItem.stage }}</b></span>
            <span class="tag tag-lg"><i class="fa-solid fa-calendar-day"></i> ចាប់ផ្តើម៖ <b>{{ selectedItem.date }}</b></span>
          </div>

          <!-- Batch Metrics Grid -->
          <div class="details-kpis-grid mb-4">
            <div class="details-kpi-box">
              <span class="text-mu text-xs"><i class="fa-solid fa-boxes-stacked"></i> ចំនួនថង់សរុប</span>
              <b>{{ fmt(selectedItem.bags) }} ថង់</b>
              <small class="text-mu">ខូច៖ {{ fmt(batchStats.bad) }} ({{ batchStats.badPct }}%)</small>
            </div>

            <div class="details-kpi-box">
              <span class="text-mu text-xs"><i class="fa-solid fa-weight-hanging"></i> ផលប្រមូលបាន</span>
              <b class="text-emerald">{{ fmt(batchStats.kg) }} គ.ក</b>
              <small class="text-mu"><b>{{ batchStats.perBagKham }} ខាំ</b>/កញ្ចប់ ({{ batchStats.perBag }} គ.ក)</small>
            </div>

            <div class="details-kpi-box">
              <span class="text-mu text-xs"><i class="fa-solid fa-arrow-trend-up"></i> ចំណូលលក់</span>
              <b class="text-inc">{{ money(batchStats.inc) }}</b>
              <small class="text-mu">ចំណាយ៖ {{ money(batchStats.exp) }}</small>
            </div>

            <div class="details-kpi-box">
              <span class="text-mu text-xs"><i class="fa-solid fa-scale-balanced"></i> ចំណេញ / ខាត</span>
              <b :class="batchStats.profit >= 0 ? 'pos' : 'neg'">{{ money(batchStats.profit) }}</b>
              <small class="text-mu">ថ្លៃដើម៖ {{ batchStats.cost !== null ? money(batchStats.cost) + '/គ.ក' : '-' }}</small>
            </div>
          </div>

          <!-- Harvest History for this batch -->
          <div class="mb-3">
            <h4 class="font-bold text-sm mb-2"><i class="fa-solid fa-basket-shopping text-purple"></i> កំណត់ត្រាប្រមូលផល ({{ batchStats.harvests.length }})</h4>
            <div v-if="batchStats.harvests.length" class="scroll-table-wrapper mini-table">
              <table class="data-table">
                <thead>
                  <tr><th>កាលបរិច្ឆេទ</th><th>ក្រេដ</th><th class="r">ផល (គ.ក)</th><th class="r">ថង់ខូច</th></tr>
                </thead>
                <tbody>
                  <tr v-for="h in batchStats.harvests" :key="h.id">
                    <td>{{ h.date }}</td>
                    <td><span class="tag">ក្រេដ {{ h.grade }}</span></td>
                    <td class="r font-bold">{{ fmt(h.kg) }} គ.ក</td>
                    <td class="r text-danger">{{ h.bad || 0 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-mu text-xs py-2">មិនទាន់មានកំណត់ត្រាប្រមូលផលសម្រាប់វគ្គនេះទេ</p>
          </div>

          <!-- Sales History for this batch -->
          <div>
            <h4 class="font-bold text-sm mb-2"><i class="fa-solid fa-money-bill-trend-up text-inc"></i> កំណត់ត្រាលក់ ({{ batchStats.sales.length }})</h4>
            <div v-if="batchStats.sales.length" class="scroll-table-wrapper mini-table">
              <table class="data-table">
                <thead>
                  <tr><th>កាលបរិច្ឆេទ</th><th>អតិថិជន</th><th class="r">លក់ (គ.ក)</th><th class="r">តម្លៃ/គ.ក</th><th class="r">សរុប</th></tr>
                </thead>
                <tbody>
                  <tr v-for="s in batchStats.sales" :key="s.id">
                    <td>{{ s.date }}</td>
                    <td><b>{{ s.cust || 'ទូទៅ' }}</b></td>
                    <td class="r">{{ fmt(s.kg) }} គ.ក</td>
                    <td class="r">{{ money(s.price) }}</td>
                    <td class="r font-bold text-inc">{{ money(s.kg * s.price) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-mu text-xs py-2">មិនទាន់មានកំណត់ត្រាលក់សម្រាប់វគ្គនេះទេ</p>
          </div>
        </template>

        <!-- Standard Fields Grid for Harvests, Incomes, Expenses -->
        <template v-else>
          <div class="fields-details-grid">
            <div v-for="f in fields" :key="f[0]" class="field-detail-item">
              <span class="detail-label">
                <i v-if="f[4]" :class="f[4]"></i> {{ f[1] }}
              </span>
              <div class="detail-value">
                <span v-if="f[0] === 'batch' || f[0] === 'batchg'" class="font-bold text-emerald">
                  <i class="fa-solid fa-seedling"></i> {{ bname(selectedItem[f[0]]) }}
                </span>
                <span v-else-if="f[0] === 'amt' || f[0] === 'price'" class="font-bold text-lg" :class="t === 'incomes' ? 'text-inc' : 'text-exp'">
                  {{ money(selectedItem[f[0]]) }}
                </span>
                <span v-else-if="f[0] === 'kg'" class="font-bold text-lg">
                  {{ fmt(selectedItem[f[0]]) }} គ.ក
                </span>
                <span v-else-if="f[0] === 'grade'" class="tag tag-lg">
                  ក្រេដ {{ selectedItem[f[0]] }}
                </span>
                <span v-else-if="f[0] === 'saleType'" class="badge tag-lg" :class="selectedItem.saleType === 'លក់រាយ' ? 'badge-retail' : 'badge-wholesale'">
                  <i :class="selectedItem.saleType === 'លក់រាយ' ? 'fa-solid fa-basket-shopping' : 'fa-solid fa-boxes-packing'"></i>
                  {{ selectedItem.saleType || 'លក់ដុំ' }}
                </span>
                <span v-else>{{ selectedItem[f[0]] || '-' }}</span>
              </div>
            </div>

            <!-- Incomes Total Calculation Box -->
            <div v-if="t === 'incomes'" class="field-detail-item col-span-full bg-ac-light p-3 rounded-lg border border-ac">
              <span class="detail-label text-emerald font-bold"><i class="fa-solid fa-calculator"></i> ទឹកប្រាក់លក់សរុប</span>
              <div class="detail-value text-inc font-bold text-xl">
                {{ money(selectedItem.kg * selectedItem.price) }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="modal-footer justify-between">
        <button class="btn btn-outline" @click="showDetailsModal = false">
          <i class="fa-solid fa-xmark"></i> បិទ
        </button>
        <div class="d-flex gap-2">
          <button v-if="t === 'incomes'" class="btn btn-outline" @click="showDetailsModal = false; openReceipt(selectedItem)">
            <i class="fa-solid fa-receipt text-emerald"></i> ចេញវិក្កយបត្រ (Invoice)
          </button>
          <button class="btn btn-primary" @click="showDetailsModal = false; openEdit(selectedItem)">
            <i class="fa-solid fa-pen-to-square"></i> កែប្រែទិន្នន័យ (Edit)
          </button>
          <button v-if="isAdmin" class="btn btn-danger" @click="del(selectedItem)">
            <i class="fa-regular fa-trash-can"></i> លុប
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- 2. EDIT MODAL (ផ្ទាំងកែប្រែទិន្នន័យ) -->
  <!-- ========================================================================= -->
  <div v-if="showEditModal && editDraft" class="modal-backdrop" @click.self="showEditModal = false">
    <div class="modal-card">
      <div class="modal-header">
        <div class="d-flex align-center gap-2">
          <div class="icon-circle bg-amber-light text-amber" style="width: 38px; height: 38px; font-size: 16px;">
            <i class="fa-solid fa-pen-to-square"></i>
          </div>
          <div>
            <h3>កែប្រែទិន្នន័យ (Edit Item)</h3>
            <span class="text-mu text-xs">{{ tabTitleKhmer }} (ID: {{ editDraft.id }})</span>
          </div>
        </div>
        <button class="icon-btn" @click="showEditModal = false">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <form @submit.prevent="saveEdit">
        <div class="modal-body modal-scroll">
          <div class="form-vertical gap-3">
            <div v-for="f in fields" :key="'edit-' + f[0]" class="form-group">
              <label class="label-text">
                <i v-if="f[4]" :class="f[4]"></i> {{ f[1] }}
              </label>

              <!-- Selection Dropdown -->
              <select v-if="f[2] === 'sel'" v-model="editDraft[f[0]]" class="form-control">
                <option v-for="o in f[3]" :key="o">{{ o }}</option>
              </select>

              <!-- Batch Selector Dropdown -->
              <select v-else-if="f[2] === 'batch' || f[2] === 'batchg'" v-model="editDraft[f[0]]" class="form-control" required>
                <option v-if="f[2] === 'batchg'" value="">ទូទៅ (មិនចាត់វគ្គ)</option>
                <option v-for="b in state.batches" :key="b.id" :value="b.id">{{ b.code }} ({{ b.type }})</option>
              </select>

              <!-- Inputs for text, number, date -->
              <input 
                v-else 
                v-model="editDraft[f[0]]" 
                :type="f[2] === 'num' ? 'number' : f[2]" 
                :step="f[2] === 'num' ? 'any' : null" 
                :min="f[2] === 'num' ? 0 : null" 
                :required="!['note', 'cust'].includes(f[0])" 
                class="form-control"
              />
            </div>

            <!-- Incomes Total Dynamic Preview in Edit Form -->
            <div v-if="t === 'incomes'" class="p-3 bg-bg rounded-lg border d-flex justify-between align-center">
              <span class="text-mu text-xs font-bold">ទឹកប្រាក់សរុប (គណនាស្វ័យប្រវត្តិ)៖</span>
              <b class="text-inc text-lg">{{ money((+editDraft.kg || 0) * (+editDraft.price || 0)) }}</b>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline" @click="showEditModal = false">បោះបង់</button>
          <button type="submit" class="btn btn-primary">
            <i class="fa-solid fa-floppy-disk"></i> រក្សាទុកការកែប្រែ
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- 3. SALES INVOICE & RECEIPT MODAL -->
  <SalesReceiptModal 
    v-if="showReceiptModal && receiptItem" 
    :item="receiptItem" 
    @close="showReceiptModal = false" 
  />
</template>
