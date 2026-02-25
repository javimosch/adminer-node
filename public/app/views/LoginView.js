import { ref, inject, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  name: 'LoginView',
  setup() {
    const store = inject('store');
    const navigate = inject('navigate');

    const drivers = ref([]);
    const form = ref({ driver: 'mysql', server: '', username: '', password: '', db: '' });
    const loading = ref(false);
    const error = ref('');

    onMounted(async () => {
      const { data } = await api.drivers();
      drivers.value = data || [];
      if (drivers.value.length) form.value.driver = drivers.value[0].id;
    });

    const isSqlite = () => form.value.driver === 'sqlite';

    async function login() {
      error.value = '';
      if (!form.value.driver) { error.value = 'Select a driver'; return; }
      loading.value = true;
      const { data, error: err } = await api.login({
        driver: form.value.driver,
        server: isSqlite() ? form.value.server : form.value.server,
        username: isSqlite() ? '' : form.value.username,
        password: isSqlite() ? '' : form.value.password,
        db: form.value.db,
      });
      loading.value = false;
      if (err) { error.value = err; return; }
      store.setAuth(data);
      navigate('/home');
    }

    return { drivers, form, loading, error, login, isSqlite };
  },
  template: `
    <div class="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex items-center justify-center p-4">
      <div class="card bg-base-100 shadow-2xl w-full max-w-md">
        <div class="card-body gap-4">
          <!-- Header -->
          <div class="text-center mb-2">
            <div class="text-5xl mb-2">🗄️</div>
            <h1 class="text-2xl font-bold">Adminer Node</h1>
            <p class="text-base-content/60 text-sm mt-1">Database Management</p>
          </div>

          <!-- Error -->
          <div v-if="error" class="alert alert-error text-sm py-2">
            <span>{{ error }}</span>
          </div>

          <!-- Driver selector -->
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

          <!-- Default DB (optional) -->
          <div class="form-control">
            <label class="label pb-1">
              <span class="label-text font-medium">Database <span class="text-base-content/50">(optional)</span></span>
            </label>
            <input v-model="form.db" type="text" placeholder="mydb"
              class="input input-bordered w-full" @keyup.enter="login" />
          </div>

          <!-- Submit -->
          <button class="btn btn-primary w-full mt-2" :class="loading ? 'btn-disabled' : ''" @click="login">
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            <span v-else>Connect</span>
          </button>
        </div>
      </div>
    </div>
  `,
};
