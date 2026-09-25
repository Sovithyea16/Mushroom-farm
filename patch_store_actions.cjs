const fs = require('fs');
let c = fs.readFileSync('src/store.js', 'utf8');

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
c += '\n' + actionsBlock;

fs.writeFileSync('src/store.js', c, 'utf8');
console.log('Added attendance actions');
