const fs = require('fs');
let c = fs.readFileSync('src/components/WorkersPayroll.vue', 'utf8');

c = c.replace(
  "isAdmin\n} from '../store'",
  "isAdmin,\n  addAttendance,\n  updateAttendance,\n  deleteAttendance\n} from '../store'"
);

c = c.replace(
  "view = ref('analytics')",
  "view = ref('attendances')"
);

c = c.replace(
  "        <button \n          :class=\"['sub-tab-btn', { active: view === 'analytics' }]\"",
  `        <button 
          :class="['sub-tab-btn', { active: view === 'attendances' }]" 
          @click="view = 'attendances'"
        >
          <i class="fa-solid fa-calendar-check"></i>
          <span>?????????????</span>
        </button>
        <button 
          :class="['sub-tab-btn', { active: view === 'analytics' }]"`
);

const attendanceView = `
    <!-- ===================================================================== -->
    <!-- VIEW 4: ATTENDANCES (???????) -->
    <!-- ===================================================================== -->
    <div v-if="view === 'attendances'" class="attendances-view card mb-4">
      <div class="card-header flex-header">
        <h3><i class="fa-solid fa-calendar-check"></i> ????????????????????????</h3>
        <div class="header-filters">
          <input type="date" v-model="attendanceDate" class="input filter-input" />
        </div>
      </div>
      <div class="card-body">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>???????????</th>
                <th>??????</th>
                <th>???????????????</th>
                <th>????????????</th>
                <th>????????</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in activeWorkersList" :key="w.id">
                <td>
                  <strong>{{ w.name }}</strong>
                  <div class="text-muted" style="font-size: 0.8rem">{{ w.phone || '????????' }}</div>
                </td>
                <td>{{ w.role }}</td>
                <td>
                  <div class="status-radios">
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="???????" v-model="getAttendance(w.id).status" @change="saveAttendance(w.id)" />
                      <span class="badge success">??????? (1)</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="?????????" v-model="getAttendance(w.id).status" @change="saveAttendance(w.id)" />
                      <span class="badge warning">????????? (0.5)</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="????????" v-model="getAttendance(w.id).status" @change="saveAttendance(w.id)" />
                      <span class="badge danger">???????? (0)</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="??????" v-model="getAttendance(w.id).status" @change="saveAttendance(w.id)" />
                      <span class="badge bg-secondary">?????? (0)</span>
                    </label>
                  </div>
                </td>
                <td>
                  <input type="text" v-model="getAttendance(w.id).note" @blur="saveAttendance(w.id)" class="input" placeholder="???????..." style="width: 120px;" />
                </td>
                <td>
                  <span v-if="getAttendance(w.id).wageId" class="badge bg-secondary">????????????</span>
                  <span v-else-if="getAttendance(w.id).id" class="text-emerald" style="font-size: 0.85rem;"><i class="fa-solid fa-check-circle"></i> ????????</span>
                </td>
              </tr>
              <tr v-if="!activeWorkersList.length">
                <td colspan="5" class="text-center text-muted py-4">???????????????????</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
`;
c = c.replace(
  '    <!-- VIEW 1: ANALYTICS & DASHBOARD',
  attendanceView + '\n    <!-- VIEW 1: ANALYTICS & DASHBOARD'
);

const jsInject = `
// ==== Attendance Logic ====
const attendanceDate = ref(new Date().toISOString().slice(0, 10))
const activeWorkersList = computed(() => state.workers.filter(w => w.status === 'active'))

const dailyAttendances = ref({})

watch(attendanceDate, (newDate) => {
  dailyAttendances.value = {}
  activeWorkersList.value.forEach(w => {
    const existing = (state.attendances || []).find(a => a.workerId === w.id && a.date === newDate)
    if (existing) {
      dailyAttendances.value[w.id] = { ...existing }
    } else {
      dailyAttendances.value[w.id] = { workerId: w.id, date: newDate, status: '', note: '', wageId: null }
    }
  })
}, { immediate: true })

function getAttendance(workerId) {
  if (!dailyAttendances.value[workerId]) {
    dailyAttendances.value[workerId] = { workerId, date: attendanceDate.value, status: '', note: '', wageId: null }
  }
  return dailyAttendances.value[workerId]
}

function saveAttendance(workerId) {
  const att = dailyAttendances.value[workerId]
  if (!att.status) return 
  
  const existing = (state.attendances || []).find(a => a.id === att.id || (a.workerId === workerId && a.date === attendanceDate.value))
  if (existing) {
    if (existing.wageId) {
      showToast('?????????????????????????????????????? ?????????????????!', 'warning')
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

// Override openAddWageModal
function openAddWageModalAuto() {
  isEditingWage.value = false
  wageForm.value = {
    id: null,
    workerId: '',
    date: new Date().toISOString().slice(0, 10),
    batchId: '',
    workType: '?????????????????? (????????)',
    workQty: 1,
    unit: '????',
    rate: 0,
    bonus: 0,
    deduction: 0,
    paymentMethod: '?????????? (Cash)',
    syncToExpense: true,
    note: '',
  }
  showWageModal.value = true
}

watch(() => wageForm.value.workerId, (wid) => {
  if (wid && !isEditingWage.value) {
    const worker = state.workers.find(w => w.id === wid)
    if (worker) {
      wageForm.value.rate = worker.baseRate || 0
      
      const unpaid = (state.attendances || []).filter(a => a.workerId === wid && !a.wageId)
      let count = 0
      unpaid.forEach(a => {
        if (a.status === '???????') count += 1
        if (a.status === '?????????') count += 0.5
      })
      
      wageForm.value.workQty = count
      if (count > 0) {
        wageForm.value.note = \`???????????????????? \${count} ????\`
      } else {
        wageForm.value.note = ''
      }
    }
  }
})

async function handleSaveWageAuto() {
  if (!wageForm.value.workerId) {
    showToast('?????????????????!', 'error')
    return
  }
  if (!wageForm.value.rate || wageForm.value.rate <= 0) {
    showToast('???????????????????? (????????????????)!', 'error')
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
    showToast('????????????????????????', 'success')
  } else {
    addWage(payload)
    const newWage = state.wages[0]
    
    const unpaid = (state.attendances || []).filter(a => a.workerId === payload.workerId && !a.wageId)
    unpaid.forEach(a => {
      updateAttendance(a.id, { wageId: newWage.id })
    })
    
    showToast(\`????????????????????? ???????????????? \${unpaid.length} ?????\`, 'success')
  }
  showWageModal.value = false
}
`;

c = c.replace(
  'function openAddWageModal() {',
  jsInject + '\nfunction openAddWageModalOriginal() {'
);

c = c.replace(
  '@click="openAddWageModal()"',
  '@click="openAddWageModalAuto()"'
);
c = c.replace(
  '@click="handleSaveWage"',
  '@click="handleSaveWageAuto"'
);

const cssInject = `
.status-radios { display: flex; gap: 10px; align-items: center; }
.radio-label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.radio-label input { margin: 0; }
`;
c = c.replace(
  '</style>',
  cssInject + '\n</style>'
);

fs.writeFileSync('src/components/WorkersPayroll.vue', c, 'utf8');
console.log('Patched WorkersPayroll.vue successfully');
