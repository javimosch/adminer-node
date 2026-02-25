import { ref, inject } from 'vue';
import { api } from '../api.js';

export default {
  name: 'DatabaseView',
  props: { params: { type: Object, default: () => ({}) } },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');
    const name = ref('');
    const collation = ref('');
    const loading = ref(false);
    const error = ref('');

    async function create() {
      error.value = '';
      if (!name.value.trim()) { error.value = 'Database name is required'; return; }
      loading.value = true;
      const { data, error: err } = await api.createDatabase({ name: name.value.trim(), collation: collation.value });
      loading.value = false;
      if (err) { error.value = err; return; }
      store.success(`Database "${name.value}" created`);
      store.setDb(name.value);
      navigate(`/db/${encodeURIComponent(name.value)}`);
    }

    async function dropDb() {
      if (!confirm(`Drop database "${store.currentDb}"? This cannot be undone.`)) return;
      loading.value = true;
      const { error: err } = await api.dropDatabase(store.currentDb);
      loading.value = false;
      if (err) { error.value = err; return; }
      store.success(`Database dropped`);
      store.setDb('');
      navigate('/home');
    }

    return { store, navigate, name, collation, loading, error, create, dropDb };
  },
  template: `
    <div class="max-w-lg space-y-4">
      <h2 class="text-xl font-bold">Create Database</h2>
      <div v-if="error" class="alert alert-error text-sm py-2">{{ error }}</div>

      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body gap-4">
          <div class="form-control">
            <label class="label pb-1"><span class="label-text font-medium">Database Name</span></label>
            <input v-model="name" type="text" placeholder="my_database"
              class="input input-bordered w-full" @keyup.enter="create" autofocus />
          </div>
          <div class="form-control">
            <label class="label pb-1"><span class="label-text font-medium">Collation <span class="text-base-content/50">(optional)</span></span></label>
            <input v-model="collation" type="text" placeholder="utf8mb4_unicode_ci"
              class="input input-bordered w-full" />
          </div>
          <div class="card-actions justify-end">
            <button class="btn btn-ghost" @click="navigate('/home')">Cancel</button>
            <button class="btn btn-primary" :class="loading ? 'btn-disabled' : ''" @click="create">
              <span v-if="loading" class="loading loading-spinner loading-sm"></span>
              Create Database
            </button>
          </div>
        </div>
      </div>

      <!-- Drop current DB -->
      <div v-if="store.currentDb" class="card bg-base-100 border border-error/30 shadow-sm">
        <div class="card-body py-4">
          <h3 class="font-semibold text-error text-sm">Danger Zone</h3>
          <p class="text-sm text-base-content/70">Drop database <strong>{{ store.currentDb }}</strong> and all its tables.</p>
          <button class="btn btn-error btn-sm w-fit" @click="dropDb">Drop Database</button>
        </div>
      </div>
    </div>
  `,
};
