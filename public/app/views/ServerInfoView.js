import { ref, inject, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  name: 'ServerInfoView',
  setup() {
    const store    = inject('store');
    const navigate = inject('navigate');

    const databases   = ref([]);
    const loading     = ref(true);
    const error       = ref('');

    onMounted(async () => {
      if (!store.conn?.driver) { loading.value = false; return; }

      if (store.conn.driver === 'sqlite') {
        databases.value = [{ name: store.conn.server || ':memory:' }];
        loading.value = false;
        return;
      }

      const { data, error: err } = await api.databases();
      loading.value = false;
      if (err) { error.value = err; return; }
      databases.value = (data?.databases || []).map(d => (typeof d === 'string' ? { name: d } : d));
    });

    function selectDb(db) {
      store.setDb(db);
      navigate(`/db/${encodeURIComponent(db)}`);
    }

    return { store, databases, loading, error, selectDb };
  },
  template: `
    <div class="space-y-6 max-w-3xl">
      <div>
        <h2 class="text-2xl font-bold">Server Info</h2>
        <p v-if="store.serverInfo" class="text-sm text-base-content/60 mt-1">
          {{ store.conn?.driver?.toUpperCase() }}
          <span v-if="store.serverInfo.version"> · v{{ store.serverInfo.version }}</span>
          <span v-if="store.conn?.server"> · {{ store.conn.server }}</span>
          <span v-if="store.conn?.username"> · {{ store.conn.username }}</span>
        </p>
        <p v-else-if="store.conn" class="text-sm text-base-content/60 mt-1">
          {{ store.conn.driver?.toUpperCase() }}
          <span v-if="store.conn.server"> · {{ store.conn.server }}</span>
          <span v-if="store.conn.username"> · {{ store.conn.username }}</span>
        </p>
      </div>

      <div v-if="error" class="alert alert-error text-sm">{{ error }}</div>

      <div v-if="loading" class="flex justify-center py-16">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <template v-else>
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-0">
            <div class="px-4 py-3 border-b border-base-300 flex items-center justify-between">
              <h3 class="font-semibold text-sm">Databases ({{ databases.length }})</h3>
              <button v-if="store.conn?.driver !== 'sqlite'"
                class="btn btn-primary btn-xs"
                @click="navigate('/db')">
                + New Database
              </button>
            </div>
            <div v-if="!databases.length" class="text-center py-10 text-base-content/40 text-sm">
              No databases found.
            </div>
            <ul v-else class="divide-y divide-base-200">
              <li v-for="db in databases" :key="db.name"
                class="flex items-center justify-between px-4 py-2.5 hover:bg-base-200/50 cursor-pointer group"
                @click="selectDb(db.name)">
                <span class="font-mono text-sm font-medium group-hover:text-primary transition-colors">{{ db.name }}</span>
                <span class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity">Browse →</span>
              </li>
            </ul>
          </div>
        </div>
      </template>
    </div>
  `,
};
