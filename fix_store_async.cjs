const fs = require('fs');
let c = fs.readFileSync('src/store.js', 'utf8');

c = c.replace(
  'import { reactive, computed, watch } from \'vue\'',
  'import { reactive, computed, watch, nextTick } from \'vue\''
);

c = c.replace(
  `  } finally {
    syncStatus.loading = false
    isFetchingFromSheets = false
  }
}

export const FIELDS`,
  `  } finally {
    syncStatus.loading = false
    nextTick(() => { isFetchingFromSheets = false })
  }
}

export const FIELDS`
);

// Remove the incorrect reset inside pushToGoogleSheets (around line 497)
c = c.replace(
  `  } finally {
    syncStatus.loading = false
    isFetchingFromSheets = false
  }
}

let isInitializingSync`,
  `  } finally {
    syncStatus.loading = false
  }
}

let isInitializingSync`
);

fs.writeFileSync('src/store.js', c, 'utf8');
console.log('Fixed async race condition');
