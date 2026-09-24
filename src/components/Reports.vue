<script setup>
import { ref, computed } from 'vue'
import { state, STAGES, fmt, money, bname, exportToCSV } from '../store'

const period = ref('month')
const customFrom = ref('')
const customTo = ref('')
const selectedBatch = ref('all')

const now = new Date()
const todayStr = now.toISOString().slice(0, 10)

// Calculate date range based on period
const dateRange = computed(() => {
  const d = new Date()
  if (period.value === 'today') {
    return { from: todayStr, to: todayStr }
  }
  if (period.value === 'week') {
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    return { from: monday.toISOString().slice(0, 10), to: todayStr }
  }
  if (period.value === 'month') {
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
    return { from: firstDay.toISOString().slice(0, 10), to: todayStr }
  }
  if (period.value === 'year') {
    const firstDay = new Date(d.getFullYear(), 0, 1)
    return { from: firstDay.toISOString().slice(0, 10), to: todayStr }
  }
  if (period.value === 'custom') {
    return { from: customFrom.value || '1970-01-01', to: customTo.value || '2099-12-31' }
  }
  return { from: '1970-01-01', to: '2099-12-31' }
})

// Filtered Records
const filteredHarvests = computed(() => {
  const { from, to } = dateRange.value
  return state.harvests.filter((x) => {
    const matchDate = (!from || x.date >= from) && (!to || x.date <= to)
    const matchBatch = selectedBatch.value === 'all' || x.batch === +selectedBatch.value
    return matchDate && matchBatch
  })
})

const filteredIncomes = computed(() => {
  const { from, to } = dateRange.value
  return state.incomes.filter((x) => {
    const matchDate = (!from || x.date >= from) && (!to || x.date <= to)
    const matchBatch = selectedBatch.value === 'all' || x.batch === +selectedBatch.value
    return matchDate && matchBatch
  })
})

const filteredExpenses = computed(() => {
  const { from, to } = dateRange.value
  return state.expenses.filter((x) => {
    const matchDate = (!from || x.date >= from) && (!to || x.date <= to)
    const matchBatch = selectedBatch.value === 'all' || (x.batch ? x.batch === +selectedBatch.value : selectedBatch.value === 'all')
    return matchDate && matchBatch
  })
})

// Summary Metrics
const totalKg = computed(() => filteredHarvests.value.reduce((t, x) => t + (+x.kg || 0), 0))
const totalBadBags = computed(() => filteredHarvests.value.reduce((t, x) => t + (+x.bad || 0), 0))
const totalIncome = computed(() => filteredIncomes.value.reduce((t, x) => t + (+x.kg || 0) * (+x.price || 0), 0))
const totalExpense = computed(() => filteredExpenses.value.reduce((t, x) => t + (+x.amt || 0), 0))
const netProfit = computed(() => totalIncome.value - totalExpense.value)
const avgPricePerKg = computed(() => {
  const totalSoldKg = filteredIncomes.value.reduce((t, x) => t + (+x.kg || 0), 0)
  return totalSoldKg ? totalIncome.value / totalSoldKg : 0
})

const batchBags = computed(() => {
  if (selectedBatch.value === 'all') {
    return state.batches.reduce((t, b) => t + (+b.bags || 0), 0)
  }
  const b = state.batches.find(x => x.id === +selectedBatch.value)
  return b ? (+b.bags || 0) : 0
})

const avgYieldPerBagKham = computed(() => {
  const bags = batchBags.value
  return bags ? ((totalKg.value / bags) * 10).toFixed(2) : '0'
})

const avgYieldPerBagKg = computed(() => {
  const bags = batchBags.value
  return bags ? (totalKg.value / bags).toFixed(2) : '0'
})

// Expense Breakdown by Category
const expensesByCategory = computed(() => {
  const map = {}
  filteredExpenses.value.forEach((x) => {
    const cat = x.cat || 'ផ្សេងៗ'
    map[cat] = (map[cat] || 0) + (+x.amt || 0)
  })
  const total = totalExpense.value || 1
  return Object.entries(map).map(([cat, amt]) => ({
    cat,
    amt,
    pct: ((amt / total) * 100).toFixed(1)
  })).sort((a, b) => b.amt - a.amt)
})

// Harvest by Grade
const gradeBreakdown = computed(() => {
  const map = { A: 0, B: 0, C: 0 }
  filteredHarvests.value.forEach((x) => {
    const g = x.grade || 'A'
    map[g] = (map[g] || 0) + (+x.kg || 0)
  })
  const total = totalKg.value || 1
  return Object.entries(map).map(([g, kg]) => ({
    grade: g,
    kg,
    pct: ((kg / total) * 100).toFixed(1)
  }))
})


// Sales breakdown by Wholesale vs Retail (លក់ដុំ vs លក់រាយ)
const salesTypeBreakdown = computed(() => {
  let wholesaleKg = 0, wholesaleAmt = 0
  let retailKg = 0, retailAmt = 0

  filteredIncomes.value.forEach((x) => {
    const kg = +x.kg || 0
    const amt = kg * (+x.price || 0)
    if (x.saleType === 'លក់រាយ') {
      retailKg += kg
      retailAmt += amt
    } else {
      wholesaleKg += kg
      wholesaleAmt += amt
    }
  })

  const totalAmt = totalIncome.value || 1
  return {
    wholesale: {
      kg: wholesaleKg,
      amt: wholesaleAmt,
      avgPrice: wholesaleKg ? Math.round(wholesaleAmt / wholesaleKg) : 0,
      pct: ((wholesaleAmt / totalAmt) * 100).toFixed(1)
    },
    retail: {
      kg: retailKg,
      amt: retailAmt,
      avgPrice: retailKg ? Math.round(retailAmt / retailKg) : 0,
      pct: ((retailAmt / totalAmt) * 100).toFixed(1)
    }
  }
})

// Incomes by Customer
const customerBreakdown = computed(() => {
  const map = {}
  filteredIncomes.value.forEach((x) => {
    const cust = x.cust || 'ទូទៅ'
    if (!map[cust]) map[cust] = { kg: 0, amt: 0 }
    map[cust].kg += +x.kg || 0
    map[cust].amt += (+x.kg || 0) * (+x.price || 0)
  })
  return Object.entries(map).map(([cust, d]) => ({
    cust,
    kg: d.kg,
    amt: d.amt
  })).sort((a, b) => b.amt - a.amt)
})

function printReport() {
  window.print()
}

function exportReportCSV() {
  const headers = ['ប្រភេទ', 'កាលបរិច្ឆេទ', 'វគ្គ', 'ព័ត៌មានលម្អិត', 'បរិមាណ/ចំនួន', 'តម្លៃ/ឯកតា', 'ទឹកប្រាក់សរុប']
  const rows = []

  filteredHarvests.value.forEach((x) => {
    rows.push(['ផលិតកម្ម', x.date, bname(x.batch), `ក្រេដ ${x.grade} (ខូច: ${x.bad || 0})`, `${x.kg} គ.ក`, '-', '-'])
  })
  filteredIncomes.value.forEach((x) => {
    rows.push(['ចំណូល (' + (x.saleType || 'លក់ដុំ') + ')', x.date, bname(x.batch), x.cust || '-', `${x.kg} គ.ក`, money(x.price), money(x.kg * x.price)])
  })
  filteredExpenses.value.forEach((x) => {
    rows.push(['ចំណាយ', x.date, bname(x.batch), `${x.cat} - ${x.note || ''}`, '-', '-', money(x.amt)])
  })

  exportToCSV(`report-${period.value}-${todayStr}`, headers, rows)
}
</script>

<template>
  <div class="report-container">
    <!-- Screen Header & Filters (Hidden on Print) -->
    <div class="report-controls card no-print">
      <div class="controls-top">
        <div class="title-box">
          <h2><i class="fa-solid fa-chart-line text-emerald"></i> របាយការណ៍កសិដ្ឋាន</h2>
          <p class="subtitle">ពិនិត្យមើលស្ថិតិផលិតកម្ម ចំណូល ចំណាយ និងប្រាក់ចំណេញតាមចន្លោះពេល</p>
        </div>

        <div class="btn-actions">
          <button class="btn btn-outline" @click="printReport">
            <i class="fa-solid fa-print"></i>
            <span>បោះពុម្ព</span>
          </button>
          <button class="btn btn-primary" @click="exportReportCSV">
            <i class="fa-solid fa-file-csv"></i>
            <span>ទាញយក CSV</span>
          </button>
        </div>
      </div>

      <!-- Filter Controls -->
      <div class="filters-row">
        <div class="filter-item">
          <label><i class="fa-solid fa-calendar-days"></i> កាលបរិច្ឆេទ</label>
          <select v-model="period" class="form-control">
            <option value="today">ថ្ងៃនេះ</option>
            <option value="week">សប្តាហ៍នេះ</option>
            <option value="month">ខែនេះ</option>
            <option value="year">ឆ្នាំនេះ</option>
            <option value="all">ទាំងអស់ (គ្រប់ពេល)</option>
            <option value="custom">កំណត់ដោយខ្លួនឯង...</option>
          </select>
        </div>

        <div v-if="period === 'custom'" class="filter-item">
          <label>ចាប់ពីថ្ងៃ</label>
          <input type="date" v-model="customFrom" class="form-control" />
        </div>

        <div v-if="period === 'custom'" class="filter-item">
          <label>ដល់ថ្ងៃ</label>
          <input type="date" v-model="customTo" class="form-control" />
        </div>

        <div class="filter-item">
          <label><i class="fa-solid fa-layer-group"></i> វគ្គផលិត</label>
          <select v-model="selectedBatch" class="form-control">
            <option value="all">គ្រប់វគ្គទាំងអស់</option>
            <option v-for="b in state.batches" :key="b.id" :value="b.id">{{ b.code }} ({{ b.type }})</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Official Printable Report Paper -->
    <div class="printable-paper">
      <!-- Printable Farm Header -->
      <div class="paper-header">
        <div class="farm-meta">
          <h1 class="farm-title">🍄 {{ state.settings.farmName || 'កសិដ្ឋានផ្សិត' }}</h1>
          <p class="farm-info"><i class="fa-solid fa-user"></i> ម្ចាស់កសិដ្ឋាន៖ <b>{{ state.settings.owner || 'អ្នកគ្រប់គ្រង' }}</b> &nbsp;|&nbsp; <i class="fa-solid fa-phone"></i> ទូរស័ព្ទ៖ <b>{{ state.settings.phone || '012 345 678' }}</b></p>
          <p class="farm-info"><i class="fa-solid fa-location-dot"></i> ទីតាំង៖ {{ state.settings.address || 'ប្រទេសកម្ពុជា' }}</p>
        </div>

        <div class="report-badge-box">
          <div class="report-title-badge">របាយការណ៍ប្រតិបត្តិការ</div>
          <div class="report-date-tag">ចន្លោះពេល៖ {{ dateRange.from }} ដល់ {{ dateRange.to }}</div>
          <div class="report-batch-tag">វគ្គ៖ {{ selectedBatch === 'all' ? 'គ្រប់វគ្គ' : bname(+selectedBatch) }}</div>
        </div>
      </div>

      <!-- KPI Overview Grid -->
      <div class="kpi-summary-grid">
        <div class="metric-card">
          <div class="metric-icon kpi-kg"><i class="fa-solid fa-weight-scale"></i></div>
          <div class="metric-info">
            <span class="metric-label">ផលប្រមូលបានសរុប</span>
            <b class="metric-val">{{ fmt(totalKg) }} គ.ក</b>
            <small class="metric-sub">ខូច៖ {{ fmt(totalBadBags) }} ថង់ | មធ្យម៖ <b>{{ avgYieldPerBagKham }} ខាំ</b>/កញ្ចប់</small>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon kpi-inc"><i class="fa-solid fa-arrow-trend-up"></i></div>
          <div class="metric-info">
            <span class="metric-label">ចំណូលសរុបពីការលក់</span>
            <b class="metric-val text-inc">{{ money(totalIncome) }}</b>
            <small class="metric-sub">តម្លៃមធ្យម៖ {{ money(avgPricePerKg) }}/គ.ក</small>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon kpi-exp"><i class="fa-solid fa-arrow-trend-down"></i></div>
          <div class="metric-info">
            <span class="metric-label">ចំណាយសរុប</span>
            <b class="metric-val text-exp">{{ money(totalExpense) }}</b>
            <small class="metric-sub">{{ filteredExpenses.length }} ប្រតិបត្តិការចំណាយ</small>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon" :class="netProfit >= 0 ? 'kpi-profit' : 'kpi-loss'">
            <i class="fa-solid" :class="netProfit >= 0 ? 'fa-scale-balanced' : 'fa-triangle-exclamation'"></i>
          </div>
          <div class="metric-info">
            <span class="metric-label">ប្រាក់ចំណេញសុទ្ធ</span>
            <b class="metric-val" :class="netProfit >= 0 ? 'pos' : 'neg'">{{ money(netProfit) }}</b>
            <small class="metric-sub">ចំណូល ដក ចំណាយ</small>
          </div>
        </div>
      </div>

      <!-- Breakdowns Section (2 columns) -->
      <div class="breakdown-grid">
        <!-- Expenses by Category -->
        <div class="card sub-card">
          <h3 class="section-title"><i class="fa-solid fa-tags text-exp"></i> ការបែងចែកចំណាយតាមប្រភេទ</h3>
          <div v-if="expensesByCategory.length" class="category-bars">
            <div v-for="c in expensesByCategory" :key="c.cat" class="cat-bar-item">
              <div class="cat-label-row">
                <span>{{ c.cat }}</span>
                <b>{{ money(c.amt) }} ({{ c.pct }}%)</b>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: c.pct + '%' }"></div>
              </div>
            </div>
          </div>
          <p v-else class="text-mu text-center py-4">គ្មានទិន្នន័យចំណាយក្នុងចន្លោះពេលនេះទេ</p>
        </div>

        <!-- Harvest by Grade -->
        <div class="card sub-card">
          <h3 class="section-title"><i class="fa-solid fa-star text-amber"></i> គុណភាពផលតាមក្រេដ</h3>
          <div class="grade-cards">
            <div v-for="g in gradeBreakdown" :key="g.grade" class="grade-box">
              <div class="grade-pill">ក្រេដ {{ g.grade }}</div>
              <b>{{ fmt(g.kg) }} គ.ក</b>
              <span>{{ g.pct }}% នៃផលសរុប</span>
            </div>
          </div>

          <h3 class="section-title mt-4"><i class="fa-solid fa-users text-blue"></i> អតិថិជនសំខាន់ៗ</h3>
          <div v-if="customerBreakdown.length" class="cust-list">
            <div v-for="cu in customerBreakdown.slice(0, 5)" :key="cu.cust" class="cust-item">
              <span><b>{{ cu.cust }}</b> ({{ fmt(cu.kg) }} គ.ក)</span>
              <b class="text-inc">{{ money(cu.amt) }}</b>
            </div>
          </div>
          <p v-else class="text-mu text-center py-2">គ្មានទិន្នន័យលក់</p>
        </div>
      </div>

      <!-- Detailed Transactions Table -->
      <div class="card sub-card mt-4">
        <h3 class="section-title"><i class="fa-solid fa-receipt text-emerald"></i> ប្រតិបត្តិការចំណូល និង ចំណាយលម្អិត</h3>
        <div class="scroll-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>ប្រភេទ</th>
                <th>កាលបរិច្ឆេទ</th>
                <th>វគ្គ</th>
                <th>ព័ត៌មានលម្អិត / អតិថិជន</th>
                <th class="r">បរិមាណ</th>
                <th class="r">ទឹកប្រាក់</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inc in filteredIncomes" :key="'inc-' + inc.id">
                <td><span class="badge badge-inc"><i class="fa-solid fa-arrow-trend-up"></i> ចំណូល</span></td>
                <td>{{ inc.date }}</td>
                <td>{{ bname(inc.batch) }}</td>
                <td>{{ inc.cust || '-' }}</td>
                <td class="r">{{ fmt(inc.kg) }} គ.ក ({{ money(inc.price) }})</td>
                <td class="r font-bold text-inc">+{{ money(inc.kg * inc.price) }}</td>
              </tr>
              <tr v-for="exp in filteredExpenses" :key="'exp-' + exp.id">
                <td><span class="badge badge-exp"><i class="fa-solid fa-arrow-trend-down"></i> ចំណាយ</span></td>
                <td>{{ exp.date }}</td>
                <td>{{ bname(exp.batch) }}</td>
                <td>{{ exp.cat }} <span v-if="exp.note" class="text-mu">({{ exp.note }})</span></td>
                <td class="r">-</td>
                <td class="r font-bold text-exp">-{{ money(exp.amt) }}</td>
              </tr>
              <tr v-if="!filteredIncomes.length && !filteredExpenses.length">
                <td colspan="6" class="text-center py-4 text-mu">មិនមានកំណត់ត្រាចំណូល ឬ ចំណាយក្នុងកាលបរិច្ឆេទនេះទេ</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Printable Signature Footer (Shown on Print) -->
      <div class="print-signatures">
        <div class="sig-block">
          <p>រៀបចំដោយ</p>
          <div class="sig-line"></div>
          <p>ហត្ថលេខា / ឈ្មោះ</p>
        </div>
        <div class="sig-block">
          <p>បានពិនិត្យ និង ឯកភាពដោយ</p>
          <div class="sig-line"></div>
          <p>ម្ចាស់កសិដ្ឋាន / អ្នកគ្រប់គ្រង</p>
        </div>
      </div>
    </div>
  </div>
</template>
