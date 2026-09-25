const fs = require('fs');
let c = fs.readFileSync('src/components/WorkersPayroll.vue', 'utf8');

c = c.replace(
  /<div class="status-radios">([\s\S]*?)<\/div>/g,
  `<div class="status-radios" v-if="dailyAttendances[w.id]">
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="???????" v-model="dailyAttendances[w.id].status" @change="saveAttendance(w.id)" />
                      <span class="badge success">??????? (1)</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="?????????" v-model="dailyAttendances[w.id].status" @change="saveAttendance(w.id)" />
                      <span class="badge warning">????????? (0.5)</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="????????" v-model="dailyAttendances[w.id].status" @change="saveAttendance(w.id)" />
                      <span class="badge danger">???????? (0)</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" :name="'status_'+w.id" value="??????" v-model="dailyAttendances[w.id].status" @change="saveAttendance(w.id)" />
                      <span class="badge bg-secondary">?????? (0)</span>
                    </label>
                  </div>`
);

c = c.replace(
  /v-model="getAttendance\(w\.id\)\.note"/g,
  `v-if="dailyAttendances[w.id]" v-model="dailyAttendances[w.id].note"`
);

c = c.replace(
  /v-if="getAttendance\(w\.id\)\.wageId"/g,
  `v-if="dailyAttendances[w.id] && dailyAttendances[w.id].wageId"`
);

c = c.replace(
  /v-else-if="getAttendance\(w\.id\)\.id"/g,
  `v-else-if="dailyAttendances[w.id] && dailyAttendances[w.id].id"`
);

// We can remove getAttendance now, but leaving it is fine.
fs.writeFileSync('src/components/WorkersPayroll.vue', c, 'utf8');
console.log('Fixed template v-models');
