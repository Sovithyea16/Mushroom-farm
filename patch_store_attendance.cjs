const fs = require('fs');
let c = fs.readFileSync('src/store.js', 'utf8');

// 1. Add to load() function
c = c.replace(
  'users: (raw.users && Array.isArray(raw.users) && raw.users.length)',
  'attendances: raw.attendances || [],\n      users: (raw.users && Array.isArray(raw.users) && raw.users.length)'
);
c = c.replace(
  "return { batches: [], harvests: [], incomes: [], expenses: [], workers: [], wages: [], materials: [], stockMovements: [], users:",
  "return { batches: [], harvests: [], incomes: [], expenses: [], workers: [], wages: [], materials: [], stockMovements: [], attendances: [], users:"
);

// 2. Add to pushToGoogleSheets payload
c = c.replace(
  "users: state.users.map(u => ({",
  `attendances: state.attendances.map(a => ({
        id: a.id,
        workerId: a.workerId,
        date: a.date,
        status: a.status,
        wageId: a.wageId,
        note: a.note
      })),
      users: state.users.map(u => ({`
);

// 3. Add to fetchFromGoogleSheets
const fetchBlock = `
      if (Array.isArray(data.attendances)) {
        state.attendances = data.attendances.map(a => ({
          ...a,
          id: +a.id || a.id,
          workerId: +a.workerId || a.workerId,
          wageId: a.wageId ? (+a.wageId || a.wageId) : null,
          date: cleanDate(a.date),
        }))
      }`;
c = c.replace(
  'if (Array.isArray(data.users) && data.users.length) {',
  fetchBlock + '\n      if (Array.isArray(data.users) && data.users.length) {'
);

// 4. Add action functions
const actionsBlock = `
export function addAttendance(p) {
  const item = { ...p, id: uid() }
  state.attendances.unshift(item)
}
export function updateAttendance(id, p) {
  const i = state.attendances.findIndex(x => x.id === id)
  if (i >= 0) Object.assign(state.attendances[i], p)
}
export function deleteAttendance(id) {
  state.attendances = state.attendances.filter(x => x.id !== id)
}
`;
c = c.replace(
  'export function addBatch(p) {',
  actionsBlock + '\nexport function addBatch(p) {'
);

fs.writeFileSync('src/store.js', c, 'utf8');
console.log('Patched store.js for attendances');
