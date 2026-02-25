import { ref, inject, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  name: 'HomeView',
  setup() {
    const store = inject('store');
    const navigate = inject('navigate');
    const databases = ref([]);
    const loading = ref(true);
    const error = ref('');

    onMounted(async () => {
      const { data, error: err } = await api.databases();
      loading.value = false;
      if (err) { error.value = err; return; }
      databases.value = data?.databases || [];
    });

    function openDb(db) {
      store.setDb(db);
      navigate(`/db/${encodeURIComponent(db)}`);
    }

    return { store, navigate, databases, loading, error, openDb };
  },
  template: `
    <div class="space-y-6 max-w-4xl">
      <!-- Server info card -->
      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body py-4">
          <h2 class="card-title text-base">Server Information</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm" v-if="store.serverInfo">
            <div>
              <div class="text-base-content/50 text-xs uppercase tracking-wide mb-1">Driver</div>
              <div class="font-mono font-medium">{{ store.conn?.driver }}</div>
            </div>
            <div>
              <div class="text-base-content/50 text-xs uppercase tracking-wide mb-1">Server</div>
              <div class="font-mono font-medium truncate">{{ store.conn?.server || '—' }}</div>
            </div>
            <div>
              <div class="text-base-content/50 text-xs uppercase tracking-wide mb-1">User</div>
              <div class="font-mono font-medium">{{ store.serverInfo?.user || store.conn?.username || '—' }}</div>
            </div>
            <div>
              <div class="text-base-content/50 text-xs uppercase tracking-wide mb-1">Version</div>
              <div class="font-mono font-medium text-xs">{{ store.serverInfo?.version || '—' }}</div>
            </div>
          </div>
          <div v-else class="text-sm text-base-content/50">Reconnect to see server details.</div>
        </div>
      </div>

      <!-- Databases -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold">Databases</h2>
          <button v-if="store.conn?.driver !== 'sqlite'" class="btn btn-sm btn-primary"
            @click="navigate('/db')">+ New Database</button>
        </div>

        <div v-if="error" class="alert alert-error text-sm">{{ error }}</div>
        <div v-if="loading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <button v-for="db in databases" :key="db"
            class="card bg-base-100 border border-base-300 shadow-sm hover:border-primary hover:shadow-md transition-all text-left p-4"
            @click="openDb(db)">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🗃️</span>
              <span class="font-medium text-sm truncate">{{ db }}</span>
            </div>
          </button>
          <div v-if="!databases.length && !loading" class="col-span-full text-center py-8 text-base-content/50">
            No databases found.
          </div>
        </div>
      </div>
    </div>
  `,
};
