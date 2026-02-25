import { ref, inject, onMounted, computed } from 'vue';
import { api } from '../api.js';

export default {
  name: 'VariablesView',
  setup() {
    const store = inject('store');
    const variables = ref([]);
    const processes = ref([]);
    const loading = ref(true);
    const error = ref('');
    const filter = ref('');
    const tab = ref('variables');

    onMounted(async () => {
      const [varRes, procRes] = await Promise.all([api.variables(), api.processList()]);
      loading.value = false;
      if (varRes.error) { error.value = varRes.error; return; }
      variables.value = varRes.data?.variables || [];
      processes.value = procRes.data?.processes || [];
    });

    async function killProcess(id) {
      if (!confirm(`Kill process ${id}?`)) return;
      const { error: err } = await api.killProcess(id);
      if (err) { store.error(err); return; }
      store.success(`Process ${id} killed`);
      processes.value = processes.value.filter(p => p.Id !== id && p.pid !== id);
    }

    const filteredVars = computed(() =>
      variables.value.filter(v => !filter.value ||
        v.name.toLowerCase().includes(filter.value.toLowerCase()) ||
        String(v.value).toLowerCase().includes(filter.value.toLowerCase())
      )
    );

    return { store, variables, processes, loading, error, filter, tab, filteredVars, killProcess };
  },
  template: `
    <div class="space-y-4 max-w-5xl">
      <h2 class="text-xl font-bold">Server Variables &amp; Processes</h2>

      <div v-if="error" class="alert alert-error text-sm">{{ error }}</div>
      <div v-if="loading" class="flex justify-center py-12"><span class="loading loading-spinner loading-lg text-primary"></span></div>

      <template v-else>
        <!-- Tabs -->
        <div class="tabs tabs-bordered">
          <button class="tab" :class="tab === 'variables' ? 'tab-active' : ''" @click="tab = 'variables'">
            Variables ({{ variables.length }})
          </button>
          <button class="tab" :class="tab === 'processes' ? 'tab-active' : ''" @click="tab = 'processes'">
            Processes ({{ processes.length }})
          </button>
        </div>

        <!-- Variables tab -->
        <div v-if="tab === 'variables'">
          <input v-model="filter" type="text" placeholder="Filter variables…"
            class="input input-bordered input-sm w-full max-w-sm mb-3" />
          <div class="overflow-x-auto rounded-lg border border-base-300">
            <table class="table table-xs table-zebra w-full">
              <thead><tr class="bg-base-200"><th>Variable</th><th>Value</th></tr></thead>
              <tbody>
                <tr v-if="!filteredVars.length">
                  <td colspan="2" class="text-center py-8 text-base-content/50">No variables found.</td>
                </tr>
                <tr v-for="v in filteredVars" :key="v.name" class="hover">
                  <td class="font-mono text-xs font-medium">{{ v.name }}</td>
                  <td class="font-mono text-xs text-base-content/80 max-w-sm truncate" :title="v.value">{{ v.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Processes tab -->
        <div v-if="tab === 'processes'">
          <div class="overflow-x-auto rounded-lg border border-base-300">
            <table class="table table-xs table-zebra w-full">
              <thead><tr class="bg-base-200"><th>PID</th><th>User</th><th>State</th><th>Query</th><th></th></tr></thead>
              <tbody>
                <tr v-if="!processes.length">
                  <td colspan="5" class="text-center py-8 text-base-content/50">No active processes.</td>
                </tr>
                <tr v-for="p in processes" :key="p.Id || p.pid" class="hover">
                  <td class="font-mono text-xs">{{ p.Id || p.pid }}</td>
                  <td class="font-mono text-xs">{{ p.User || p.usename }}</td>
                  <td><span class="badge badge-xs badge-outline">{{ p.State || p.state }}</span></td>
                  <td class="font-mono text-xs max-w-xs truncate">{{ p.Info || p.query }}</td>
                  <td>
                    <button class="btn btn-ghost btn-xs text-error" @click="killProcess(p.Id || p.pid)">Kill</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  `,
};
