const fs = require('fs');
let c = fs.readFileSync('src/components/WorkersPayroll.vue', 'utf8');

const oldFunc = `function getAttendance(workerId) {
  if (!dailyAttendances.value[workerId]) {
    dailyAttendances.value[workerId] = { workerId, date: attendanceDate.value, status: '', note: '', wageId: null }
  }
  return dailyAttendances.value[workerId]
}`;
const newFunc = `function getAttendance(workerId) {
  if (!dailyAttendances.value[workerId]) {
    return { status: '', note: '' } // safe fallback for render
  }
  return dailyAttendances.value[workerId]
}`;
c = c.replace(oldFunc, newFunc);

c = c.replace(
  `watch(attendanceDate, (newDate) => {`,
  `watch([attendanceDate, activeWorkersList], ([newDate, workers]) => {`
);

c = c.replace(
  `activeWorkersList.value.forEach(w => {`,
  `workers.forEach(w => {`
);

fs.writeFileSync('src/components/WorkersPayroll.vue', c, 'utf8');
console.log('Fixed infinite loop');
