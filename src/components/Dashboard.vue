<script setup>
import { computed } from 'vue'
import { stats, monthly, stageCounts, money, fmt } from '../store'

const max = computed(() => Math.max(1, ...monthly.value.flatMap((m) => [m.inc, m.exp])))
const h = (v) => (v / max.value) * 140
</script>

<template>
  <!-- KPI Summary Cards -->
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-icon kpi-inc">
        <i class="fa-solid fa-arrow-trend-up"></i>
      </div>
      <div class="kpi-body">
        <span class="kpi-label">ចំណូលសរុប</span>
        <b class="kpi-val">{{ money(stats.income) }}</b>
      </div>
    </div>

    <div class="kpi">
      <div class="kpi-icon kpi-exp">
        <i class="fa-solid fa-arrow-trend-down"></i>
      </div>
      <div class="kpi-body">
        <span class="kpi-label">ចំណាយសរុប</span>
        <b class="kpi-val">{{ money(stats.expense) }}</b>
      </div>
    </div>

    <div class="kpi">
      <div class="kpi-icon" :class="stats.profit >= 0 ? 'kpi-profit' : 'kpi-loss'">
        <i class="fa-solid" :class="stats.profit >= 0 ? 'fa-scale-balanced' : 'fa-triangle-exclamation'"></i>
      </div>
      <div class="kpi-body">
        <span class="kpi-label">ចំណេញ / ខាត</span>
        <b class="kpi-val" :class="stats.profit >= 0 ? 'pos' : 'neg'">{{ money(stats.profit) }}</b>
      </div>
    </div>

    <div class="kpi">
      <div class="kpi-icon kpi-kg">
        <i class="fa-solid fa-basket-shopping"></i>
      </div>
      <div class="kpi-body">
        <span class="kpi-label">ផលិតផលសរុប</span>
        <b class="kpi-val">{{ fmt(stats.kg) }} គ.ក</b>
      </div>
    </div>
  </div>

  <!-- Chart + Stages Row -->
  <div class="row">
    <!-- 6 Month Income vs Expense Chart -->
    <section class="card chart-card">
      <div class="card-head">
        <h3><i class="fa-solid fa-chart-column"></i> ចំណូល vs ចំណាយ (៦ ខែ)</h3>
        <div class="legend">
          <span class="legend-tag"><i class="fa-solid fa-circle text-inc"></i> ចំណូល</span>
          <span class="legend-tag"><i class="fa-solid fa-circle text-exp"></i> ចំណាយ</span>
        </div>
      </div>
      <div class="chart-wrap">
        <svg viewBox="0 0 360 180" class="chart">
          <!-- Background guideline -->
          <line x1="10" y1="150" x2="350" y2="150" stroke="var(--ln)" stroke-width="1" />
          <line x1="10" y1="80" x2="350" y2="80" stroke="var(--ln)" stroke-dasharray="3,3" stroke-width="0.8" opacity="0.6" />
          <line x1="10" y1="10" x2="350" y2="10" stroke="var(--ln)" stroke-dasharray="3,3" stroke-width="0.8" opacity="0.6" />

          <g v-for="(m, i) in monthly" :key="m.key" :transform="`translate(${i * 58 + 14},0)`">
            <rect x="0" :y="150 - h(m.inc)" width="18" :height="h(m.inc)" class="b-inc" rx="3" />
            <rect x="21" :y="150 - h(m.exp)" width="18" :height="h(m.exp)" class="b-exp" rx="3" />
            <text x="20" y="168" text-anchor="middle" class="lbl">{{ m.key.slice(5) }}/{{ m.key.slice(2, 4) }}</text>
          </g>
        </svg>
      </div>
    </section>

    <!-- Stages Breakdown -->
    <section class="card stages-card">
      <div class="card-head">
        <h3><i class="fa-solid fa-bars-progress"></i> វគ្គតាមដំណាក់កាល</h3>
      </div>
      <div class="stage-list">
        <div v-for="s in stageCounts" :key="s.s" class="stage-item">
          <span class="stage-name">
            <i class="fa-regular fa-circle-dot stage-bullet"></i>
            {{ s.s }}
          </span>
          <span class="stage-badge" :class="{ 'has-batches': s.n > 0 }">{{ s.n }}</span>
        </div>
      </div>
    </section>
  </div>

  <!-- Comparison Table -->
  <section class="card table-card">
    <div class="card-head">
      <h3><i class="fa-solid fa-table-list"></i> ប្រៀបធៀបតាមវគ្គ</h3>
      <span class="text-hint"><i class="fa-solid fa-arrows-left-right"></i> អូសដើម្បីមើលបន្ថែម</span>
    </div>

    <div class="scroll-table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class="sticky-col"><i class="fa-solid fa-barcode"></i> វគ្គ</th>
            <th><i class="fa-solid fa-shapes"></i> ប្រភេទ</th>
            <th><i class="fa-solid fa-bars-progress"></i> ដំណាក់កាល</th>
            <th class="r"><i class="fa-solid fa-boxes-stacked"></i> ថង់</th>
            <th class="r"><i class="fa-solid fa-triangle-exclamation"></i> ខូច %</th>
            <th class="r"><i class="fa-solid fa-weight-hanging"></i> ផល (គ.ក)</th>
            <th class="r"><i class="fa-solid fa-scale-unbalanced"></i> ទិន្នផល/កញ្ចប់ (ខាំ)</th>
            <th class="r"><i class="fa-solid fa-arrow-trend-up"></i> ចំណូល</th>
            <th class="r"><i class="fa-solid fa-arrow-trend-down"></i> ចំណាយ</th>
            <th class="r"><i class="fa-solid fa-scale-balanced"></i> ចំណេញ</th>
            <th class="r"><i class="fa-solid fa-tag"></i> ថ្លៃដើម/គ.ក</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in stats.rows" :key="r.b.id">
            <td class="sticky-col font-bold"><b>{{ r.b.code }}</b></td>
            <td><span class="tag">{{ r.b.type }}</span></td>
            <td><span class="stage-tag">{{ r.b.stage }}</span></td>
            <td class="r">{{ fmt(r.b.bags) }}</td>
            <td class="r" :class="{ 'neg': r.badPct > 10 }">{{ fmt(r.badPct) }}%</td>
            <td class="r font-bold">{{ fmt(r.kg) }}</td>
            <td class="r font-bold text-emerald">{{ fmt(r.perBagKham) }} ខាំ <small class="text-mu block text-xs">({{ fmt(r.perBag) }} គ.ក)</small></td>
            <td class="r text-inc">{{ money(r.inc) }}</td>
            <td class="r text-exp">{{ money(r.exp) }}</td>
            <td class="r font-bold" :class="r.profit >= 0 ? 'pos' : 'neg'">{{ money(r.profit) }}</td>
            <td class="r">{{ r.cost === null ? '-' : money(r.cost) }}</td>
          </tr>
          <tr v-if="!stats.rows.length">
            <td colspan="11" class="table-empty">
              <i class="fa-solid fa-circle-info"></i>
              <span>សូមបង្កើតវគ្គនៅក្នុងផ្ទាំង «វគ្គ» ដើម្បីមើលការប្រៀបធៀប</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="stats.general" class="general-note">
      <i class="fa-solid fa-circle-exclamation"></i>
      <span>ចំណាយទូទៅ (មិនទាន់ចាត់វគ្គ)៖ <b>{{ money(stats.general) }}</b> — ត្រូវបានបូកបញ្ចូលក្នុងចំណាយសរុប</span>
    </div>
  </section>
</template>
