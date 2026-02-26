import { inject, ref, onMounted } from 'vue';
import AppLayout from '../components/AppLayout.js';

const DRIVER_ICONS = { mysql: '🐬', pgsql: '🐘', sqlite: '📦' };
const DRIVER_LABELS = { mysql: 'MySQL / MariaDB', pgsql: 'PostgreSQL', sqlite: 'SQLite' };

export default {
  name: 'HomeView',
  components: { AppLayout },
  setup() {
    const store    = inject('store');
    const navigate = inject('navigate');
    const api      = inject('api');

    const connections  = ref([]);
    const connecting   = ref(null); // id of connection being auto-connected
    const loadingConns = ref(true);

    onMounted(async () => {
      const { data } = await api.connections();
      connections.value = (data?.connections) || [];
      loadingConns.value = false;
    });

    async function autoConnect(conn) {
      if (connecting.value) return;
      connecting.value = conn.id;
      const { data, error } = await api.autoConnect(conn.id);
      if (error) {
        store.addMessage(error || 'Connection failed', 'error');
      } else {
        store.setAuth(data);
        store.addMessage(`Connected to ${conn.label}`, 'success');
        navigate('/databases');
      }
      connecting.value = null;
    }

    function goLogin() { navigate('/login'); }

    return { store, connections, connecting, loadingConns, autoConnect, goLogin,
             DRIVER_ICONS, DRIVER_LABELS };
  },
  template: `
    <app-layout :crumbs="[{ label: 'Home', path: '/' }]">
      <div class="max-w-4xl mx-auto py-8 px-4">

        <!-- Header -->
        <div class="text-center mb-10">
          <div class="text-6xl mb-3">🗄️</div>
          <h1 class="text-3xl font-bold mb-2">adminer-node</h1>
          <p class="text-base-content/60">Lightweight database management UI</p>
        </div>

        <!-- Saved connections -->
        <template v-if="loadingConns">
          <div class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>
        </template>

        <template v-else-if="connections.length">
          <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>⚡</span> Saved Connections
            <span class="badge badge-primary badge-outline">{{ connections.length }}</span>
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div
              v-for="conn in connections"
              :key="conn.id"
              class="card bg-base-200 hover:bg-base-300 shadow cursor-pointer transition-all"
              @click="autoConnect(conn)"
            >
              <div class="card-body p-5 flex-row items-center gap-4">
                <div class="text-4xl">{{ DRIVER_ICONS[conn.driver] || '🗄️' }}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold truncate">{{ conn.label }}</div>
                  <div class="text-sm text-base-content/50 truncate">
                    {{ DRIVER_LABELS[conn.driver] || conn.driver }}
                    {{ conn.server ? '· ' + conn.server : '' }}
                    {{ conn.db ? '· ' + conn.db : '' }}
                  </div>
                </div>
                <div v-if="connecting === conn.id">
                  <span class="loading loading-spinner loading-sm text-primary"></span>
                </div>
                <div v-else class="badge badge-ghost">Connect →</div>
              </div>
            </div>
          </div>
          <div class="divider">or connect manually</div>
        </template>

        <!-- Manual connect button -->
        <div class="text-center" :class="{ 'mt-4': !connections.length }">
          <button class="btn btn-primary btn-lg gap-2" @click="goLogin">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Connect to a Database
          </button>
          <p class="text-base-content/40 text-sm mt-3">MySQL, MariaDB, PostgreSQL, SQLite</p>
        </div>

        <!-- Already connected -->
        <div v-if="store.auth" class="alert alert-info mt-8">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
          <div>
            Already connected as <strong>{{ store.auth.conn?.username || 'anonymous' }}</strong>
            on <strong>{{ store.auth.conn?.server }}</strong>.
            <button class="btn btn-xs btn-ghost ml-2" @click="navigate('/databases')">Browse →</button>
          </div>
        </div>

      </div>
    </app-layout>
  `,
};
