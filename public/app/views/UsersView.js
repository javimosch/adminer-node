import { ref, inject, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  name: 'UsersView',
  setup() {
    const store = inject('store');
    const navigate = inject('navigate');
    const users = ref([]);
    const loading = ref(true);
    const error = ref('');
    const filter = ref('');

    onMounted(async () => {
      const { data, error: err } = await api.users();
      loading.value = false;
      if (err) { error.value = err; return; }
      users.value = data?.users || [];
    });

    const filtered = () => users.value.filter(u =>
      !filter.value || (u.user || '').toLowerCase().includes(filter.value.toLowerCase())
    );

    return { store, navigate, users, loading, error, filter, filtered };
  },
  template: `
    <div class="space-y-4 max-w-3xl">
      <h2 class="text-xl font-bold">Users &amp; Privileges</h2>

      <div v-if="error" class="alert alert-error text-sm">{{ error }}</div>
      <div v-if="loading" class="flex justify-center py-12"><span class="loading loading-spinner loading-lg text-primary"></span></div>

      <template v-else>
        <input v-if="users.length > 6" v-model="filter" type="text" placeholder="Filter users…"
          class="input input-bordered input-sm w-full max-w-sm" />

        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="overflow-x-auto">
            <table class="table table-sm w-full">
              <thead><tr class="bg-base-200">
                <th>Username</th><th>Host</th><th>Attributes</th>
              </tr></thead>
              <tbody>
                <tr v-if="!filtered().length">
                  <td colspan="3" class="text-center py-8 text-base-content/50">No users found or insufficient privileges.</td>
                </tr>
                <tr v-for="u in filtered()" :key="(u.user || '') + (u.host || '')" class="hover">
                  <td class="font-mono font-medium text-sm">{{ u.user || u.rolname || '—' }}</td>
                  <td class="font-mono text-sm text-base-content/70">{{ u.host || 'n/a' }}</td>
                  <td>
                    <div class="flex gap-1 flex-wrap">
                      <span v-if="u.rolsuper || u.Super_priv === 'Y'" class="badge badge-error badge-xs">SUPER</span>
                      <span v-if="u.rolcreatedb" class="badge badge-warning badge-xs">CREATEDB</span>
                      <span v-if="u.rolcreaterole" class="badge badge-info badge-xs">CREATEROLE</span>
                      <span v-if="u.rolcanlogin === false" class="badge badge-ghost badge-xs">NO LOGIN</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="!users.length && !loading" class="text-sm text-base-content/50">
          User management requires GRANT privileges or connection as a superuser.
        </div>
      </template>
    </div>
  `,
};
