/**
 * =========================================================================
 * Google Apps Script សម្រាប់ធ្វើជា Database ពេញលេញនៃ Mushroom Farm Dashboard
 * =========================================================================
 * គាំទ្រការ Sync ទាំង ១០ ផ្នែកនៃកសិដ្ឋាន៖
 * 1. Batches (វគ្គផលិតកម្ម)
 * 2. Harvests (ផលប្រមូលបាន)
 * 3. Incomes (ចំណូលពីការលក់)
 * 4. Expenses (ចំណាយ)
 * 5. Workers (កម្មករ)
 * 6. Wages (ប្រាក់ឈ្នួល)
 * 7. Materials (ស្តុកសម្ភារៈ)
 * 8. StockMovements (បន្លាស់ប្តូរស្តុក)
 * 9. Users (គណនី Admin & User, PIN, Permissions)
 * 10. Settings (ព័ត៌មានកសិដ្ឋាន, អាសយដ្ឋាន, អត្រាប្តូរប្រាក់, ប្រភេទផ្សិត)
 * =========================================================================
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var data = {
    batches: getSheetData(ss, 'Batches', ['id', 'code', 'type', 'bags', 'date', 'stage']),
    harvests: getSheetData(ss, 'Harvests', ['id', 'batch', 'kg', 'grade', 'bad', 'date']),
    incomes: getSheetData(ss, 'Incomes', ['id', 'batch', 'saleType', 'kg', 'price', 'date', 'cust', 'note']),
    expenses: getSheetData(ss, 'Expenses', ['id', 'batch', 'cat', 'amt', 'date', 'note']),
    workers: getSheetData(ss, 'Workers', ['id', 'name', 'phone', 'role', 'rate', 'unit', 'status', 'address', 'joinDate', 'note']),
    wages: getSheetData(ss, 'Wages', ['id', 'workerId', 'workerName', 'date', 'batchId', 'workType', 'workQty', 'unit', 'rate', 'baseAmt', 'bonus', 'deduction', 'totalPaid', 'paymentMethod', 'syncToExpense', 'note']),
    materials: getSheetData(ss, 'Materials', ['id', 'name', 'cat', 'unit', 'qty', 'minQty', 'price', 'supplier', 'note']),
    stockMovements: getSheetData(ss, 'StockMovements', ['id', 'materialId', 'type', 'qty', 'unit', 'cost', 'date', 'batchId', 'reason', 'note']),
    users: getSheetData(ss, 'Users', ['id', 'name', 'username', 'role', 'pin', 'status', 'address', 'permissions']),
    settings: getSheetData(ss, 'Settings', ['farm', 'owner', 'phone', 'address', 'rate', 'cur', 'types', 'cats']),
    sheetsFound: ss.getSheets().map(function(s) { return s.getName(); })
  };

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.batches) saveSheetData(ss, 'Batches', ['id', 'code', 'type', 'bags', 'date', 'stage'], data.batches);
    if (data.harvests) saveSheetData(ss, 'Harvests', ['id', 'batch', 'kg', 'grade', 'bad', 'date'], data.harvests);
    if (data.incomes) saveSheetData(ss, 'Incomes', ['id', 'batch', 'saleType', 'kg', 'price', 'date', 'cust', 'note'], data.incomes);
    if (data.expenses) saveSheetData(ss, 'Expenses', ['id', 'batch', 'cat', 'amt', 'date', 'note'], data.expenses);
    if (data.workers) saveSheetData(ss, 'Workers', ['id', 'name', 'phone', 'role', 'rate', 'unit', 'status', 'address', 'joinDate', 'note'], data.workers);
    if (data.wages) saveSheetData(ss, 'Wages', ['id', 'workerId', 'workerName', 'date', 'batchId', 'workType', 'workQty', 'unit', 'rate', 'baseAmt', 'bonus', 'deduction', 'totalPaid', 'paymentMethod', 'syncToExpense', 'note'], data.wages);
    if (data.materials) saveSheetData(ss, 'Materials', ['id', 'name', 'cat', 'unit', 'qty', 'minQty', 'price', 'supplier', 'note'], data.materials);
    if (data.stockMovements) saveSheetData(ss, 'StockMovements', ['id', 'materialId', 'type', 'qty', 'unit', 'cost', 'date', 'batchId', 'reason', 'note'], data.stockMovements);
    if (data.users) saveSheetData(ss, 'Users', ['id', 'name', 'username', 'role', 'pin', 'status', 'address', 'permissions'], data.users);
    if (data.settings) saveSheetData(ss, 'Settings', ['farm', 'owner', 'phone', 'address', 'rate', 'cur', 'types', 'cats'], data.settings);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Synced successfully',
      sheetsFound: ss.getSheets().map(function(s) { return s.getName(); })
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ស្វែងរក Sheet ដោយមិនប្រកាន់អក្សរតូចធំ (Case-Insensitive) និងគាំទ្រ singular/plural (incomes / income)
function findSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  var sheets = ss.getSheets();
  var target = name.toLowerCase().trim();

  // 1. ស្វែងរកតាមឈ្មោះត្រួតពិនិត្យអក្សរតូចធំ
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase().trim() === target) {
      return sheets[i];
    }
  }

  // 2. ស្វែងរកតាមទម្រង់ឯកវចនៈ / ពហុវចនៈ (batches <-> batch, incomes <-> income)
  for (var j = 0; j < sheets.length; j++) {
    var cur = sheets[j].getName().toLowerCase().trim();
    if (cur.replace(/s$/, '') === target.replace(/s$/, '')) return sheets[j];
    if (cur.replace(/es$/, '') === target.replace(/es$/, '')) return sheets[j];
  }

  return null;
}

function getOrCreateSheet(ss, name) {
  var sheet = findSheet(ss, name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function getSheetData(ss, sheetName, headers) {
  var sheet = findSheet(ss, sheetName);
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var sheetHeaders = values[0].map(function(h) { return String(h).trim(); });
  var rows = [];

  for (var r = 1; r < values.length; r++) {
    var rowObj = {};
    var hasData = false;
    for (var c = 0; c < sheetHeaders.length; c++) {
      var key = sheetHeaders[c];
      var val = values[r][c];

      // ការពារបញ្ហា Date format (ដូចជា 1899-12-30)
      if (val instanceof Date) {
        var yr = val.getFullYear();
        if (yr <= 1900) {
          val = 0;
        } else {
          var mo = String(val.getMonth() + 1);
          if (mo.length < 2) mo = '0' + mo;
          var dy = String(val.getDate());
          if (dy.length < 2) dy = '0' + dy;
          val = yr + '-' + mo + '-' + dy;
        }
      }

      if (val !== '' && val !== null && val !== undefined) hasData = true;
      rowObj[key] = val;
    }
    if (hasData) rows.push(rowObj);
  }
  return rows;
}

function saveSheetData(ss, sheetName, headers, items) {
  var sheet = getOrCreateSheet(ss, sheetName);
  
  sheet.clearContents();

  // កំណត់ Header ជួរទី ១
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  if (!items || !items.length) return;

  var rows = items.map(function(item) {
    return headers.map(function(h) {
      var v = item[h];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}
