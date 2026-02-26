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

    const connections      = ref([]);
    const loadingConns     = ref(true);
    const connecting       = ref(null);
    const basicAuthEnabled = ref(true); // assume true until status loaded

    // Remove connection modal
    const removeTarget = ref(null);
    const removing     = ref(false);

    // Basic Auth setup modal
    const showAuthModal = ref(false);
    const authForm      = ref({ username: 'admin', password: '', password2: '' });
    const authError     = ref('');
    const authSaving    = ref(false);
    const authDone      = ref(false);
    const authCountdown = ref(5);

    onMounted(async () => {
      const [statusRes, connsRes] = await Promise.all([
        api.get('/api/status'),
        api.connections(),
      ]);
      basicAuthEnabled.value = statusRes.data?.basicAuthEnabled ?? false;
      connections.value = connsRes.data?.connections || [];
      loadingConns.value = false;
    });

    async function autoConnect(conn) {
      if (connecting.value) return;

      // If this connection is already active, just navigate back to it
      if (store.authenticated && store.connId === conn.id) {
        navigate('/databases');
        return;
      }

      connecting.value = conn.id;

      // If a different connection is active, log out first
      if (store.authenticated) {
        await api.logout();
        store.clearAuth();
      }

      const { data, error } = await api.autoConnect(conn.id);
      if (error) {
        store.addMessage(error || 'Connection failed', 'error');
      } else {
        store.setAuth(data);
        store.addMessage('Connected to ' + conn.label, 'success');
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
      const { error } = await api.del('/api/connections/' + encodeURIComponent(removeTarget.value.id));
      if (error) {
        store.addMessage(error || 'Failed to remove', 'error');
      } else {
        connections.value = connections.value.filter(c => c.id !== removeTarget.value.id);
        store.addMessage('Removed "' + removeTarget.value.label + '"', 'success');
      }
      removeTarget.value = null;
      removing.value = false;
    }
    function cancelRemove() { removeTarget.value = null; }

    function openAuthModal() {
      authForm.value = { username: 'admin', password: '', password2: '' };
      authError.value = '';
      authDone.value = false;
      authCountdown.value = 5;
      showAuthModal.value = true;
    }
    function closeAuthModal() {
      if (authDone.value) return; // don't close while counting down
      showAuthModal.value = false;
    }

    async function saveBasicAuth() {
      authError.value = '';
      const { username, password, password2 } = authForm.value;
      if (!username.trim()) { authError.value = 'Username is required'; return; }
      if (password.length < 3) { authError.value = 'Password must be at least 3 characters'; return; }
      if (password !== password2) { authError.value = 'Passwords do not match'; return; }
      authSaving.value = true;
      const { data, error } = await api.post('/api/config/basic-auth', { username: username.trim(), password });
      authSaving.value = false;
      if (error) { authError.value = error; return; }
      authDone.value = true;
      basicAuthEnabled.value = true;
      authCountdown.value = 5;
      const tick = setInterval(() => {
        authCountdown.value--;
        if (authCountdown.value <= 0) { clearInterval(tick); window.location.reload(); }
      }, 1000);
    }

    function goLogin() { navigate('/login'); }

    return {
      store, connections, loadingConns, connecting, basicAuthEnabled,
      removeTarget, removing,
      showAuthModal, authForm, authError, authSaving, authDone, authCountdown,
      autoConnect, askRemove, confirmRemove, cancelRemove,
      openAuthModal, closeAuthModal, saveBasicAuth, goLogin,
      DRIVER_ICONS, DRIVER_LABELS,
    };
  },
  template: `
    <div class="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex flex-col">
      <FlashMessage />

      <!-- Remove connection modal -->
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

      <!-- Basic Auth setup modal -->
      <dialog :class="['modal', showAuthModal ? 'modal-open' : '']">
        <div class="modal-box max-w-md">
          <template v-if="authDone">
            <div class="text-center py-6">
              <div class="text-5xl mb-4">🔒</div>
              <h3 class="text-xl font-bold mb-3 text-success">Basic Auth enabled!</h3>
              <div class="text-sm space-y-2 text-base-content/70">
                <p>✅ <strong>Done:</strong> Credentials saved to your config file.</p>
                <p>🔄 <strong>Next:</strong> Page reloads in <strong>{{ authCountdown }}s</strong> — your browser will then prompt for the username &amp; password you just set.</p>
                <p class="text-xs text-base-content/50 mt-3">All future visitors must enter these credentials before reaching adminer-node.</p>
              </div>
              <div class="mt-5">
                <span class="loading loading-dots loading-md text-primary"></span>
              </div>
            </div>
          </template>
          <template v-else>
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="closeAuthModal">✕</button>
            <h3 class="font-bold text-lg mb-1">Enable HTTP Basic Auth</h3>
            <p class="text-sm text-base-content/60 mb-4">
              Adds a browser-level password prompt in front of adminer-node.
              Recommended when exposing this instance on a public or shared network.
            </p>
            <div v-if="authError" class="alert alert-error text-sm py-2 mb-3">
              <span>{{ authError }}</span>
            </div>
            <div class="form-control mb-3">
              <label class="label py-1"><span class="label-text font-medium">Username</span></label>
              <input
                v-model="authForm.username"
                type="text"
                class="input input-bordered input-sm"
                placeholder="admin"
                autocomplete="username"
              />
            </div>
            <div class="form-control mb-3">
              <label class="label py-1"><span class="label-text font-medium">Password</span></label>
              <input
                v-model="authForm.password"
                type="password"
                class="input input-bordered input-sm"
                placeholder="At least 3 characters"
                autocomplete="new-password"
              />
            </div>
            <div class="form-control mb-5">
              <label class="label py-1"><span class="label-text font-medium">Confirm password</span></label>
              <input
                v-model="authForm.password2"
                type="password"
                class="input input-bordered input-sm"
                placeholder="Repeat password"
                autocomplete="new-password"
                @keyup.enter="saveBasicAuth"
              />
            </div>
            <div class="modal-action mt-0">
              <button class="btn btn-ghost btn-sm" @click="closeAuthModal">Cancel</button>
              <button class="btn btn-primary btn-sm" :disabled="authSaving" @click="saveBasicAuth">
                <span v-if="authSaving" class="loading loading-spinner loading-xs"></span>
                Enable Basic Auth
              </button>
            </div>
          </template>
        </div>
        <div v-if="!authDone" class="modal-backdrop" @click="closeAuthModal"></div>
      </dialog>

      <!-- Main content -->
      <div class="flex-1 flex flex-col items-center justify-center p-6">
        <div class="w-full max-w-2xl">

          <!-- Header -->
          <div class="text-center mb-8">
            <h1 class="text-4xl font-bold tracking-tight mb-1">adminer-node</h1>
            <p class="text-base-content/50 text-sm">Lightweight database admin UI</p>
          </div>

          <!-- ⚠️ No Basic Auth warning -->
          <div v-if="!loadingConns && !basicAuthEnabled" class="alert alert-warning shadow mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div class="flex items-start gap-2 flex-1">
              <span class="text-xl mt-0.5">⚠️</span>
              <div>
                <div class="font-semibold">No HTTP Basic Auth configured</div>
                <div class="text-sm opacity-80">Anyone who can reach this URL has full access to adminer-node. Enable Basic Auth to require a username &amp; password.</div>
              </div>
            </div>
            <button class="btn btn-sm btn-warning shrink-0" @click="openAuthModal">
              🔒 Set up Basic Auth
            </button>
          </div>

          <!-- Saved connections -->
          <template v-if="!loadingConns && connections.length > 0">
            <h2 class="text-sm font-semibold text-base-content/50 uppercase tracking-wider mb-3">Saved connections</h2>
            <div class="grid gap-3 mb-6">
              <div
                v-for="conn in connections"
                :key="conn.id"
                :class="[
                  'card bg-base-100 shadow transition-shadow',
                  store.authenticated && store.connId === conn.id
                    ? 'ring-2 ring-success cursor-pointer hover:shadow-md'
                    : connecting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'
                ]"
                @click="autoConnect(conn)"
              >
                <div class="card-body p-4 flex-row items-center gap-4">
                  <span class="text-3xl">{{ DRIVER_ICONS[conn.driver] || '🗄️' }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold truncate">{{ conn.label }}</div>
                    <div class="text-xs text-base-content/50">{{ DRIVER_LABELS[conn.driver] || conn.driver }}</div>
                  </div>
                  <span v-if="connecting === conn.id" class="loading loading-spinner loading-sm text-primary"></span>
                  <template v-else>
                    <span v-if="store.authenticated && store.connId === conn.id"
                      class="badge badge-success badge-sm gap-1 shrink-0">
                      ● Active
                    </span>
                    <button
                      class="btn btn-ghost btn-xs text-base-content/30 hover:text-error hover:bg-error/10"
                      title="Remove"
                      @click="askRemove(conn, $event)"
                    >✕</button>
                  </template>
                </div>
              </div>
            </div>
            <div class="text-center">
              <button class="btn btn-outline btn-sm" @click="goLogin">＋ Connect to another database</button>
            </div>
          </template>

          <!-- No saved connections -->
          <template v-else-if="!loadingConns">
            <div class="text-center">
              <button class="btn btn-primary btn-lg" @click="goLogin">Connect to a Database</button>
            </div>
          </template>

          <!-- Loading -->
          <template v-else>
            <div class="flex justify-center py-10">
              <span class="loading loading-dots loading-lg text-primary"></span>
            </div>
          </template>

        </div>
      </div>
    </div>
  `,
};
