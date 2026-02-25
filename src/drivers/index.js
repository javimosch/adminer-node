const DRIVERS = ['mysql', 'pgsql', 'sqlite'];

export async function loadDrivers() {
  for (const id of DRIVERS) {
    try {
      await import(`./${id}.js`);
    } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'MODULE_NOT_FOUND') {
        // npm package not installed — skip silently
      } else {
        console.warn(`Driver "${id}" failed to load:`, e.message);
      }
    }
  }
}
