const fs = require('fs');
let c = fs.readFileSync('src/components/WorkersPayroll.vue', 'utf8');

const jsInject = `
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
function openAddWageModalAuto(presetWorker = null) {
  isEditingWage.value = false
  wageForm.value = {
    id: null,
    workerId: presetWorker ? presetWorker.id : '',
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

// Insert the JS right before `function openAddWageModal`
const hookStr = 'function openAddWageModal(';
const insertIdx = c.indexOf(hookStr);
if(insertIdx !== -1) {
  c = c.substring(0, insertIdx) + jsInject + '\n' + c.substring(insertIdx);
} else {
  console.log('Could not find openAddWageModal hook!');
}

// Replace all remaining openAddWageModal with Auto version
c = c.replace(/openAddWageModal\(/g, 'openAddWageModalAuto(');
c = c.replace(/function openAddWageModalAutoAuto/g, 'function openAddWageModalOriginal');

fs.writeFileSync('src/components/WorkersPayroll.vue', c, 'utf8');
console.log('Fixed JS injection');
