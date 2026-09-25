const fs = require('fs');
let c = fs.readFileSync('src/store.js', 'utf8');

c = c.replace(
  'workers: state.workers,',
  `workers: state.workers.map(w => ({
        id: w.id,
        name: w.name,
        phone: w.phone,
        role: w.role,
        rate: w.baseRate !== undefined ? w.baseRate : w.rate,
        unit: w.wageType !== undefined ? w.wageType : w.unit,
        status: w.status,
        address: w.address,
        joinDate: w.startDate !== undefined ? w.startDate : w.joinDate,
        note: w.notes !== undefined ? w.notes : w.note
      })),`
);

c = c.replace(
  'materials: state.materials,',
  `materials: state.materials.map(m => ({
        id: m.id,
        name: m.name,
        cat: m.cat,
        unit: m.unit,
        qty: m.currentStock !== undefined ? m.currentStock : m.qty,
        minQty: m.minStock !== undefined ? m.minStock : m.minQty,
        price: m.unitCost !== undefined ? m.unitCost : m.price,
        supplier: m.supplier,
        note: m.notes !== undefined ? m.notes : m.note
      })),`
);

c = c.replace(
  'stockMovements: state.stockMovements,',
  `stockMovements: state.stockMovements.map(s => ({
        id: s.id,
        materialId: s.materialId,
        type: s.type,
        qty: s.qty,
        unit: s.unit || '',
        cost: s.totalCost !== undefined ? s.totalCost : s.cost,
        date: s.date,
        batchId: s.batchId,
        reason: s.reason || '',
        note: s.note
      })),`
);

c = c.replace(
  "farm: state.settings.farm || '',",
  "farm: state.settings.farmName || state.settings.farm || '',"
);

c = c.replace(
  `      if (Array.isArray(data.workers)) {
        state.workers = data.workers.map(w => ({
          ...w,
          id: +w.id || w.id,
          rate: +w.rate || 0,
        }))
      }`,
  `      if (Array.isArray(data.workers)) {
        state.workers = data.workers.map(w => ({
          ...w,
          id: +w.id || w.id,
          baseRate: +w.rate || 0,
          wageType: w.unit || '?.?',
          startDate: cleanDate(w.joinDate) || '',
          notes: w.note || '',
        }))
      }`
);

c = c.replace(
  `      if (Array.isArray(data.materials)) {
        state.materials = data.materials.map(m => ({
          ...m,
          id: +m.id || m.id,
          qty: +m.qty || 0,
          minQty: +m.minQty || 0,
          price: +m.price || 0,
        }))
      }`,
  `      if (Array.isArray(data.materials)) {
        state.materials = data.materials.map(m => ({
          ...m,
          id: +m.id || m.id,
          currentStock: +m.qty || 0,
          minStock: +m.minQty || 0,
          unitCost: +m.price || 0,
          notes: m.note || '',
        }))
      }`
);

c = c.replace(
  `      if (Array.isArray(data.stockMovements)) {
        state.stockMovements = data.stockMovements.map(s => ({
          ...s,
          id: +s.id || s.id,
          materialId: +s.materialId || s.materialId,
          batchId: s.batchId ? (+s.batchId || s.batchId) : '',
          qty: +s.qty || 0,
          cost: +s.cost || 0,
          date: cleanDate(s.date),
        }))
      }`,
  `      if (Array.isArray(data.stockMovements)) {
        state.stockMovements = data.stockMovements.map(s => ({
          ...s,
          id: +s.id || s.id,
          materialId: +s.materialId || s.materialId,
          batchId: s.batchId ? (+s.batchId || s.batchId) : '',
          qty: +s.qty || 0,
          totalCost: +s.cost || 0,
          date: cleanDate(s.date),
        }))
      }`
);

c = c.replace(
  'if (s.farm) state.settings.farm = s.farm',
  'if (s.farm) state.settings.farmName = s.farm'
);

fs.writeFileSync('src/store.js', c, 'utf8');
console.log('Done mapping fixing');
