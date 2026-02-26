import { ref, inject, onMounted } from 'vue';

export default {
  name: 'LoginView',
  setup() {
    const store    = inject('store');
    const navigate = inject('navigate');
    const api      = inject('api');

    const drivers  = ref([]);
    const form     = ref({ driver: 'mysql', server: '', username: '', password: '', db: '', label: '', saveConn: false });
    const loading  = ref(false);
    const error    = ref('');

    onMounted(async () => {
      const { data } = await api.drivers();
      drivers.value = data || [];
      if (drivers.value.length) form.value.driver = drivers.value[0].id;
    });

    const isSqlite = () => form.value.driver === 'sqlite';

    // Auto-fill label when server/db change
    function autoLabel() {
      if (!form.value.label) return; // only auto-fill if user hasn't typed manually
      // keep it auto
    }

    function defaultLabel() {
      const f = form.value;
      if (f.db) return `${f.driver}/${f.db}@${f.server || 'local'}`;
      return `${f.driver}@${f.server || 'local'}`;
    }

    async function login() {
      error.value = '';
      if (!form.value.driver) { error.value = 'Select a driver'; return; }
      loading.value = true;

      const payload = {
        driver:   form.value.driver,
        server:   form.value.server,
        username: isSqlite() ? '' : form.value.username,
        password: isSqlite() ? '' : form.value.password,
        db:       form.value.db,
      };

      const { data, error: err } = await api.login(payload);
      if (err) { error.value = err; loading.value = false; return; }

      // Optionally save connection to server config file
      if (form.value.saveConn) {
        const label = form.value.label.trim() || defaultLabel();
        const { error: saveErr } = await api.post('/api/connections', {
          label,
          driver:   payload.driver,
          server:   payload.server,
          username: payload.username,
          password: payload.password,
          db:       payload.db,
        });
        if (saveErr) {
          // Non-fatal: inform but don't block login
          store.addMessage(`Could not save connection: ${saveErr}`, 'error');
        } else {
          store.addMessage(`Connection "${label}" saved`, 'success');
        }
      }

      loading.value = false;
      store.setAuth(data);
      navigate('/databases');
    }

    return { drivers, form, loading, error, login, isSqlite };
  },
  template: `
    <div class="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex flex-col">
      <div class="flex-1 flex items-center justify-center p-4">
        <div class="card bg-base-100 shadow-2xl w-full max-w-md">
          <div class="card-body gap-4">

            <!-- Header -->
            <div class="text-center mb-2">
              <div class="text-5xl mb-2">🗄️</div>
              <h1 class="text-2xl font-bold">Adminer Node</h1>
              <p class="text-base-content/60 text-sm mt-1">Database Management</p>
            </div>

            <!-- Back to home (if any) -->
            <div class="text-left -mb-1">
              <a href="#/" class="btn btn-ghost btn-xs gap-1 text-base-content/50">
                ← Back
              </a>
            </div>

            <!-- Error -->
            <div v-if="error" class="alert alert-error text-sm py-2">
              <span>{{ error }}</span>
            </div>

            <!-- Driver -->
            <div class="form-control">
              <label class="label pb-1"><span class="label-text font-medium">Driver</span></label>
              <select v-model="form.driver" class="select select-bordered w-full">
                <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </div>

            <!-- Server / file path -->
            <div class="form-control">
              <label class="label pb-1">
                <span class="label-text font-medium">{{ isSqlite() ? 'File path' : 'Server' }}</span>
              </label>
              <input v-model="form.server" type="text"
                :placeholder="isSqlite() ? '/path/to/database.db or :memory:' : 'localhost:3306'"
                class="input input-bordered w-full" @keyup.enter="login" />
            </div>

            <!-- Username / Password (hidden for SQLite) -->
            <template v-if="!isSqlite()">
              <div class="form-control">
                <label class="label pb-1"><span class="label-text font-medium">Username</span></label>
                <input v-model="form.username" type="text" placeholder="root"
                  class="input input-bordered w-full" autocomplete="username" @keyup.enter="login" />
              </div>
              <div class="form-control">
                <label class="label pb-1"><span class="label-text font-medium">Password</span></label>
                <input v-model="form.password" type="password" placeholder="••••••••"
                  class="input input-bordered w-full" autocomplete="current-password" @keyup.enter="login" />
              </div>
            </template>

            <!-- Database (optional) -->
            <div class="form-control">
              <label class="label pb-1">
                <span class="label-text font-medium">Database <span class="text-base-content/50">(optional)</span></span>
              </label>
              <input v-model="form.db" type="text" placeholder="mydb"
                class="input input-bordered w-full" @keyup.enter="login" />
            </div>

            <!-- Save connection toggle -->
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3 py-1">
                <input type="checkbox" v-model="form.saveConn" class="checkbox checkbox-primary checkbox-sm" />
                <span class="label-text">Save this connection for quick access</span>
              </label>
            </div>

            <!-- Label (shown when saveConn is checked) -->
            <div v-if="form.saveConn" class="form-control -mt-2">
              <label class="label pb-1">
                <span class="label-text text-sm text-base-content/70">Connection label <span class="text-base-content/40">(optional)</span></span>
              </label>
              <input v-model="form.label" type="text"
                :placeholder="'e.g. Production MySQL'"
                class="input input-bordered input-sm w-full" />
              <label class="label pt-1">
                <span class="label-text-alt text-base-content/40">Saved to ~/.config/adminer-node/config.json</span>
              </label>
            </div>

            <!-- Submit -->
            <button class="btn btn-primary w-full mt-1" :disabled="loading" @click="login">
              <span v-if="loading" class="loading loading-spinner loading-sm"></span>
              <span v-else>Connect</span>
            </button>

          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center py-4 text-xs text-base-content/30">
        adminer-node · <a href="https://intrane.fr" target="_blank" class="hover:text-base-content/60">intrane.fr</a>
      </div>
    </div>
  `,
};
