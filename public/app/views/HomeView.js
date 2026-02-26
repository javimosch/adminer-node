import { inject, ref, onMounted } from 'vue';
import FlashMessage from '../components/FlashMessage.js';
import Modal from '../components/Modal.js';

const DRIVER_ICONS  = { mysql: '🐬', pgsql: '🐘', sqlite: '📦' };
const DRIVER_LABELS = { mysql: 'MySQL / MariaDB', pgsql: 'PostgreSQL', sqlite: 'SQLite' };

export default {
  name: 'HomeView',
  components: { FlashMessage, Modal },
  setup() {
    const store    = inject('store');
    const navigate = inject('navigate');
    const api      = inject('api');

    const connections  = ref([]);
    const loadingConns = ref(true);
    const connecting   = ref(null);

    // Remove-connection modal state
    const removeTarget = ref(null); // conn object to remove
    const removing     = ref(false);

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

    function askRemove(conn, e) {
      e.stopPropagation();
      removeTarget.value = conn;
    }

    async function confirmRemove() {
      if (!removeTarget.value || removing.value) return;
      removing.value = true;
      const { error } = await api.del(`/api/connections/${encodeURIComponent(removeTarget.value.id)}`);
      if (error) {
        store.addMessage(error || 'Failed to remove connection', 'error');
      } else {
        connections.value = connections.value.filter(c => c.id !== removeTarget.value.id);
        store.addMessage(`Removed "${removeTarget.value.label}"`, 'success');
      }
      removeTarget.value = null;
      removing.value = false;
    }

    function cancelRemove() { removeTarget.value = null; }

    function goLogin() { navigate('/login'); }

    return {
      store, connections, loadingConns, connecting,
      removeTarget, removing,
      autoConnect, askRemove, confirmRemove, cancelRemove, goLogin,
      DRIVER_ICONS, DRIVER_LABELS,
    };
  },
  template: `
    <div class="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex flex-col">
      <FlashMessage />

      <!-- Remove confirmation modal -->
      <Modal
        :open="!!removeTarget"
        title="Remove saved connection"
        confirm-label="Remove"
        confirm-class="btn-error"
        @confirm="confirmRemove"
        @cancel="cancelRemove"
      >
        <p>Remove <strong>{{ removeTarget?.label }}</strong> from saved connections?</p>
        <p class="text-sm text-base-content/60 mt-1">This only removes it from the config file — the database itself is not affected.</p>
      </Modal>

      <div class="flex-1 flex items-center justify-center p-4">
        <div class="w-full max-w-2xl">

          <!-- Header -->
          <div class="text-center mb-8">
            <div class="text-6xl mb-3">🗄️</div>
            <h1 class="text-3xl font-bold mb-1">adminer-node</h1>
            <p class="text-base-content/50 text-sm">Database Management UI</p>
          </div>

          <!-- Loading -->
          <template v-if="loadingConns">
            <div class="flex justify-center py-8">
              <span class="loading loading-spinner loading-md text-primary"></span>
            </div>
          </template>

          <!-- No saved connections → show connect button only -->
          <template v-else-if="!connections.length">
            <div class="text-center">
              <button class="btn btn-primary btn-lg gap-2" @click="goLogin">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect to a Database
              </button>
              <p class="text-base-content/40 text-sm mt-3">MySQL · MariaDB · PostgreSQL · SQLite</p>
            </div>
          </template>

          <!-- Saved connections list -->
          <template v-else>
            <h2 class="text-base font-semibold mb-3 flex items-center gap-2 text-base-content/70">
              <span>⚡</span> Saved Connections
              <span class="badge badge-primary badge-sm badge-outline">{{ connections.length }}</span>
            </h2>

            <div class="flex flex-col gap-3 mb-6">
              <div
                v-for="conn in connections"
                :key="conn.id"
                class="card bg-base-100 hover:bg-base-200 shadow-sm cursor-pointer transition-all border border-base-300 hover:border-primary"
                @click="autoConnect(conn)"
              >
                <div class="card-body p-4 flex-row items-center gap-4">
                  <div class="text-3xl flex-shrink-0">{{ DRIVER_ICONS[conn.driver] || '🗄️' }}</div>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold truncate">{{ conn.label }}</div>
                    <div class="text-xs text-base-content/50 truncate">
                      {{ DRIVER_LABELS[conn.driver] || conn.driver }}
                      <span v-if="conn.server"> · {{ conn.server }}</span>
                      <span v-if="conn.db"> · {{ conn.db }}</span>
                    </div>
                  </div>
                  <div v-if="connecting === conn.id" class="flex-shrink-0">
                    <span class="loading loading-spinner loading-sm text-primary"></span>
                  </div>
                  <template v-else>
                    <span class="badge badge-ghost badge-sm flex-shrink-0">Connect →</span>
                    <button
                      class="btn btn-ghost btn-xs text-error opacity-40 hover:opacity-100 flex-shrink-0"
                      title="Remove from saved connections"
                      @click="askRemove(conn, $event)"
                    >✕</button>
                  </template>
                </div>
              </div>
            </div>

            <div class="divider text-xs text-base-content/40">or</div>

            <div class="text-center mt-4">
              <button class="btn btn-outline btn-sm gap-2" @click="goLogin">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Connect to another database
              </button>
            </div>
          </template>

        </div>
      </div>

      <!-- Footer -->
      <div class="text-center py-4 text-xs text-base-content/30">
        adminer-node · <a href="https://intrane.fr" target="_blank" class="hover:text-base-content/60">intrane.fr</a>
      </div>
    </div>
  `,
};
