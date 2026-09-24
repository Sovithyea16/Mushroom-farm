<script setup>
import { reactive, computed } from 'vue'
import { state, fmt, money, bname } from '../store'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const config = reactive({
  paperSize: 'a5', // 'a5' | 'pos'
  discount: 0,
  paymentMethod: 'សាច់ប្រាក់ (Cash)',
  customNote: 'សូមអរគុណចំពោះការគាំទ្រផលិតផលផ្សិតធម្មជាតិពីកសិដ្ឋានយើងខ្ញុំ!',
  customerPhone: ''
})

const batch = computed(() => {
  if (!props.item?.batch) return null
  return state.batches.find(b => b.id === props.item.batch)
})

const subtotal = computed(() => {
  if (!props.item) return 0
  return (+props.item.kg || 0) * (+props.item.price || 0)
})

const grandTotal = computed(() => {
  const sub = subtotal.value
  const disc = +config.discount || 0
  return Math.max(0, sub - disc)
})

const invoiceNo = computed(() => {
  if (!props.item) return ''
  const dateStr = (props.item.date || '').replace(/-/g, '')
  const idStr = String(props.item.id).slice(-4)
  return 'INV-' + dateStr + '-' + idStr
})

const secondaryCurrencyText = computed(() => {
  const rate = +state.settings.rate || 4100
  if (state.cur === '$') {
    const khr = Math.round(grandTotal.value * rate)
    return `~ ${fmt(khr)} ៛ (អត្រាប្តូរប្រាក់ 1$ = ${fmt(rate)}៛)`
  } else {
    const usd = (grandTotal.value / rate).toFixed(2)
    return `~ $${fmt(usd)} (អត្រាប្តូរប្រាក់ 1$ = ${fmt(rate)}៛)`
  }
})

function printReceipt() {
  document.body.classList.add('printing-invoice')
  window.print()
  setTimeout(() => {
    document.body.classList.remove('printing-invoice')
  }, 1200)
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card modal-lg invoice-modal-container">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="d-flex align-center gap-2">
          <div class="icon-circle bg-emerald-light text-emerald" style="width: 38px; height: 38px; font-size: 16px;">
            <i class="fa-solid fa-receipt"></i>
          </div>
          <div>
            <h3>ចេញវិក្កយបត្រលក់ / Sales Receipt</h3>
            <span class="text-mu text-xs">លេខវិក្កយបត្រ៖ {{ invoiceNo }}</span>
          </div>
        </div>
        <button class="icon-btn" @click="emit('close')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Config Toolbar -->
      <div class="p-3 bg-bg border-b receipt-config-toolbar">
        <div class="d-flex justify-between align-center flex-wrap gap-2 mb-2">
          <!-- Paper Size Toggle -->
          <div class="d-flex align-center gap-1">
            <span class="text-mu text-xs font-bold mr-1">ទម្រង់ក្រដាស៖</span>
            <button 
              type="button" 
              class="btn btn-sm" 
              :class="config.paperSize === 'a5' ? 'btn-primary' : 'btn-outline'"
              @click="config.paperSize = 'a5'"
            >
              <i class="fa-solid fa-file-lines"></i> ទម្រង់ស្តង់ដារ (A5 / A4)
            </button>
            <button 
              type="button" 
              class="btn btn-sm" 
              :class="config.paperSize === 'pos' ? 'btn-primary' : 'btn-outline'"
              @click="config.paperSize = 'pos'"
            >
              <i class="fa-solid fa-receipt"></i> វិក្កយបត្រ POS (80mm)
            </button>
          </div>

          <!-- Quick Action Buttons -->
          <div class="d-flex gap-2">
            <button class="btn btn-primary" @click="printReceipt">
              <i class="fa-solid fa-print"></i> បោះពុម្ពវិក្កយបត្រ (Print)
            </button>
            <button class="btn btn-outline" @click="emit('close')">
              <i class="fa-solid fa-xmark"></i> បិទ
            </button>
          </div>
        </div>

        <!-- Optional In-Modal Customization Fields -->
        <div class="grid grid-4 gap-2 pt-2 border-t">
          <div>
            <label class="text-xs text-mu font-bold d-block mb-1">វិធីទូទាត់ប្រាក់</label>
            <select v-model="config.paymentMethod" class="form-control text-xs">
              <option value="សាច់ប្រាក់ (Cash)">សាច់ប្រាក់ (Cash)</option>
              <option value="ផ្ទេរប្រាក់ (ABA / Bakong)">ផ្ទេរប្រាក់ (ABA / Bakong)</option>
              <option value="ជំពាក់ (Credit)">ជំពាក់ (Credit)</option>
            </select>
          </div>

          <div>
            <label class="text-xs text-mu font-bold d-block mb-1">ទូរស័ព្ទអតិថិជន</label>
            <input 
              v-model="config.customerPhone" 
              type="text" 
              placeholder="លេខទូរស័ព្ទ..." 
              class="form-control text-xs" 
            />
          </div>

          <div>
            <label class="text-xs text-mu font-bold d-block mb-1">បញ្ចុះតម្លៃ (Discount)</label>
            <input 
              v-model.number="config.discount" 
              type="number" 
              min="0" 
              :max="subtotal" 
              step="any" 
              class="form-control text-xs" 
            />
          </div>

          <div>
            <label class="text-xs text-mu font-bold d-block mb-1">កំណត់សម្គាល់បាតវិក្កយបត្រ</label>
            <input 
              v-model="config.customNote" 
              type="text" 
              class="form-control text-xs" 
            />
          </div>
        </div>
      </div>

      <!-- Receipt Preview Body -->
      <div class="modal-body modal-scroll py-4" style="background: #e2e8f0; display: flex; justify-content: center;">
        
        <!-- ========================================== -->
        <!-- FORMAT 1: A5 / A4 STANDARD INVOICE LAYOUT  -->
        <!-- ========================================== -->
        <div 
          v-if="config.paperSize === 'a5'" 
          class="printable-invoice-paper invoice-a5-layout"
        >
          <!-- Header: Farm Profile & Invoice Metadata -->
          <div class="inv-header-row">
            <div class="d-flex align-center gap-3">
              <div class="inv-logo-icon">🍄</div>
              <div>
                <h2 class="inv-farm-name">{{ state.settings.farm || 'កសិដ្ឋានបណ្ដុះផ្សិត' }}</h2>
                <div class="inv-farm-sub">MUSHROOM FARM PRODUCTION & SALES</div>
                <div class="inv-contacts mt-1">
                  <div><i class="fa-solid fa-user-tie"></i> ម្ចាស់កសិដ្ឋាន៖ <b>{{ state.settings.owner || 'លោកម្ចាស់កសិដ្ឋាន' }}</b></div>
                  <div><i class="fa-solid fa-phone"></i> ទំនាក់ទំនង៖ <b>{{ state.settings.phone || '012 345 678' }}</b></div>
                  <div><i class="fa-solid fa-location-dot"></i> អាសយដ្ឋាន៖ <span>{{ state.settings.address || 'ប្រទេសកម្ពុជា' }}</span></div>
                </div>
              </div>
            </div>

            <div class="inv-title-box">
              <div class="inv-badge-title">វិក្កយបត្រលក់</div>
              <div class="inv-badge-sub">SALES INVOICE & RECEIPT</div>
              <div class="inv-meta-grid mt-2">
                <div class="inv-meta-item"><span>លេខវិក្កយបត្រ៖</span> <b>{{ invoiceNo }}</b></div>
                <div class="inv-meta-item"><span>កាលបរិច្ឆេទ៖</span> <b>{{ item.date }}</b></div>
                <div class="inv-meta-item"><span>ការទូទាត់៖</span> <b>{{ config.paymentMethod }}</b></div>
              </div>
            </div>
          </div>

          <!-- Customer Info Card -->
          <div class="inv-customer-card mt-3">
            <div class="d-flex justify-between align-center flex-wrap gap-2">
              <div>
                <span class="text-mu text-xs font-bold">ព័ត៌មានអតិថិជន (BILLED TO)៖</span>
                <div class="inv-cust-name">{{ item.cust || 'អតិថិជនទូទៅ (General Customer)' }}</div>
              </div>
              <div v-if="config.customerPhone" class="text-xs">
                <span class="text-mu">ទូរស័ព្ទ៖ </span> <b>{{ config.customerPhone }}</b>
              </div>
              <div v-if="item.note" class="text-xs">
                <span class="text-mu">កំណត់ត្រា៖ </span> <i>{{ item.note }}</i>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="mt-3">
            <table class="inv-items-table">
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">ល.រ</th>
                  <th style="text-align: left;">បរិយាយមុខទំនិញ (Description)</th>
                  <th style="text-align: right; width: 110px;">បរិមាណ (Qty)</th>
                  <th style="text-align: right; width: 120px;">តម្លៃឯកតា (Price)</th>
                  <th style="text-align: right; width: 130px;">សរុប (Amount)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align: center;">1</td>
                  <td>
                    <b>ផ្សិត{{ batch?.type || 'ធម្មជាតិ' }}</b>
                    <span class="text-mu text-xs d-block">
                      វគ្គផលិតកម្ម៖ {{ bname(item.batch) }}
                    </span>
                  </td>
                  <td style="text-align: right;"><b>{{ fmt(item.kg) }}</b> គ.ក្រ (kg)</td>
                  <td style="text-align: right;">{{ money(item.price) }}</td>
                  <td style="text-align: right;"><b>{{ money(subtotal) }}</b></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Bottom Totals & Notes -->
          <div class="inv-bottom-section mt-3">
            <div class="inv-notes-box">
              <div class="font-bold text-xs"><i class="fa-solid fa-circle-info text-emerald"></i> លក្ខខណ្ឌ និងសម្គាល់៖</div>
              <p class="inv-note-text">{{ config.customNote }}</p>
              <div class="inv-payment-badge mt-2">
                <span class="text-mu text-xs">វិធីទូទាត់ប្រាក់៖</span> <b>{{ config.paymentMethod }}</b>
              </div>
            </div>

            <div class="inv-totals-box">
              <div class="inv-total-row">
                <span class="text-mu">សរុបរង (Subtotal)៖</span>
                <b>{{ money(subtotal) }}</b>
              </div>
              <div v-if="config.discount > 0" class="inv-total-row text-danger">
                <span>បញ្ចុះតម្លៃ (Discount)៖</span>
                <b>- {{ money(config.discount) }}</b>
              </div>
              <div class="inv-total-row inv-grand-total">
                <span>សរុបត្រូវបង់ (Total Due)៖</span>
                <b class="text-emerald">{{ money(grandTotal) }}</b>
              </div>
              <div class="inv-dual-currency text-right">
                {{ secondaryCurrencyText }}
              </div>
            </div>
          </div>

          <!-- Signatures Section -->
          <div class="inv-signatures-row mt-4">
            <div class="inv-sig-box">
              <p>ហត្ថលេខា និងឈ្មោះអ្នកទិញ</p>
              <div class="inv-sig-space"></div>
              <div class="inv-sig-line"></div>
              <small>{{ item.cust || 'អតិថិជន' }}</small>
            </div>

            <div class="inv-sig-box">
              <p>ហត្ថលេខាអ្នកលក់ / បេឡា</p>
              <div class="inv-sig-space"></div>
              <div class="inv-sig-line"></div>
              <small>{{ state.settings.owner || 'អ្នកគ្រប់គ្រងកសិដ្ឋាន' }}</small>
            </div>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- FORMAT 2: POS 80MM SLIP LAYOUT             -->
        <!-- ========================================== -->
        <div 
          v-else 
          class="printable-invoice-paper pos-mode"
        >
          <div class="pos-center">
            <div class="pos-farm-icon">🍄</div>
            <h3 class="pos-farm-name">{{ state.settings.farm || 'កសិដ្ឋានបណ្ដុះផ្សិត' }}</h3>
            <p class="pos-info">{{ state.settings.address || 'ប្រទេសកម្ពុជា' }}</p>
            <p class="pos-info">ទូរស័ព្ទ៖ {{ state.settings.phone || '012 345 678' }}</p>
            <div class="pos-title">វិក្កយបត្រ / RECEIPT</div>
          </div>

          <div class="pos-divider"></div>

          <div class="pos-meta">
            <div><b>លេខបុង៖</b> {{ invoiceNo }}</div>
            <div><b>កាលបរិច្ឆេទ៖</b> {{ item.date }}</div>
            <div><b>អតិថិជន៖</b> {{ item.cust || 'អតិថិជនទូទៅ' }}</div>
            <div v-if="config.customerPhone"><b>ទូរស័ព្ទ៖</b> {{ config.customerPhone }}</div>
            <div><b>ទូទាត់៖</b> {{ config.paymentMethod }}</div>
          </div>

          <div class="pos-divider"></div>

          <div class="pos-item-header d-flex justify-between font-bold mb-1">
            <span>មុខទំនិញ</span>
            <span>តម្លៃ</span>
          </div>

          <div>
            <div class="font-bold">ផ្សិត{{ batch?.type || 'ធម្មជាតិ' }} ({{ bname(item.batch) }})</div>
            <div class="d-flex justify-between text-mu">
              <span>{{ fmt(item.kg) }} kg x {{ money(item.price) }}</span>
              <span class="font-bold text-dark">{{ money(subtotal) }}</span>
            </div>
          </div>

          <div class="pos-divider"></div>

          <div class="pos-totals">
            <div class="d-flex justify-between">
              <span>សរុបរង៖</span>
              <span>{{ money(subtotal) }}</span>
            </div>
            <div v-if="config.discount > 0" class="d-flex justify-between text-danger">
              <span>បញ្ចុះតម្លៃ៖</span>
              <span>-{{ money(config.discount) }}</span>
            </div>
            <div class="d-flex justify-between pos-grand-total">
              <span>សរុបចុងក្រោយ៖</span>
              <span>{{ money(grandTotal) }}</span>
            </div>
            <div class="text-right text-mu text-xs mt-1">
              {{ secondaryCurrencyText }}
            </div>
          </div>

          <div class="pos-divider"></div>

          <div class="pos-center">
            <p class="pos-thankyou">{{ config.customNote }}</p>
            <div class="pos-barcode-text mt-2">*{{ invoiceNo }}*</div>
          </div>
        </div>

      </div>

      <!-- Footer Toolbar -->
      <div class="modal-footer justify-between">
        <div class="text-mu text-xs d-flex align-center gap-1">
          <i class="fa-solid fa-lightbulb text-amber"></i>
          <span>ជ្រើសរើសទម្រង់ក្រដាសរួចចុចបោះពុម្ព ឬរក្សាទុកជា PDF (Save as PDF)</span>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline" @click="emit('close')">
            <i class="fa-solid fa-xmark"></i> បិទ
          </button>
          <button class="btn btn-primary" @click="printReceipt">
            <i class="fa-solid fa-print"></i> បោះពុម្ពវិក្កយបត្រ (Print)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
