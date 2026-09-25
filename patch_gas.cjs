const fs = require('fs');
let c = fs.readFileSync('google-apps-script.js', 'utf8');

c = c.replace(
  '9. Users (???? Admin & User, PIN, Permissions)\n * 10. Settings (???????????????, ?????????, ????????????????, ???????????)',
  '9. Users (???? Admin & User, PIN, Permissions)\n * 10. Settings (???????????????, ?????????, ????????????????, ???????????)\n * 11. Attendances (?????????????)'
);

c = c.replace(
  "settings: getSheetData(ss, 'Settings', ['farm', 'owner', 'phone', 'address', 'rate', 'cur', 'types', 'cats']),",
  "settings: getSheetData(ss, 'Settings', ['farm', 'owner', 'phone', 'address', 'rate', 'cur', 'types', 'cats']),\n    attendances: getSheetData(ss, 'Attendances', ['id', 'workerId', 'date', 'status', 'wageId', 'note']),"
);

c = c.replace(
  "if (data.settings) saveSheetData(ss, 'Settings', ['farm', 'owner', 'phone', 'address', 'rate', 'cur', 'types', 'cats'], data.settings);",
  "if (data.settings) saveSheetData(ss, 'Settings', ['farm', 'owner', 'phone', 'address', 'rate', 'cur', 'types', 'cats'], data.settings);\n    if (data.attendances) saveSheetData(ss, 'Attendances', ['id', 'workerId', 'date', 'status', 'wageId', 'note'], data.attendances);"
);

fs.writeFileSync('google-apps-script.js', c, 'utf8');
console.log('Done patch');
