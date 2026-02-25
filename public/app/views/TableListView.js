import { ref, inject, onMounted, watch } from 'vue';
import { api } from '../api.js';

export default {
  name: 'TableListView',
  props: { params: { type: Object, default: () => ({}) } },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');
    const tables = ref([]);
    const loading = ref(true);
    const error = ref('');
    const filter = ref('');

    async function load() {
      const db = props.params.db || store.currentDb;
      if (!db) return;
      store.setDb(db);
      loading.value = true;
      const { data, error: err } = await api.tables(db);
      loading.value = false;
      if (err) { error.value = err; return; }
      tables.value = data?.tables || [];
    }

    onMounted(load);
    watch(() => props.params.db, load);

    function openTable(t) {
      store.setTable(t.name);
      navigate(`/db/${encodeURIComponent(props.params.db)}/table/${encodeURIComponent(t.name)}/select`);
    }

    function openStructure(t) {
      store.setTable(t.name);
      navigate(`/db/${encodeURIComponent(props.params.db)}/table/${encodeURIComponent(t.name)}`);
    }

    async function truncateTable(t) {
      if (!confirm(`Truncate table "${t.name}"? All rows will be deleted.`)) return;
      const { error: err } = await api.truncateTable(t.name, props.params.db);
      if (err) { store.error(err); return; }
      store.success(`Table "${t.name}" truncated`);
    }

    async function dropTable(t) {
      if (!confirm(`Drop table "${t.name}"? This cannot be undone.`)) return;
      const { error: err } = await api.dropTable(t.name, props.params.db);
      if (err) { store.error(err); return; }
      store.success(`Table "${t.name}" dropped`);
      tables.value = tables.value.filter(x => x.name !== t.name);
    }

    const filtered = () => tables.value.filter(t => !filter.value || t.name.toLowerCase().includes(filter.value.toLowerCase()));

    return { store, navigate, tables, loading, error, filter, openTable, openStructure, truncateTable, dropTable, filtered, params: props.params };
  },
  template: `
    <div class="space-y-4 max-w-4xl">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">{{ params.db }}</h2>
        <div class="flex gap-2">
          <a :href="'#/db/' + encodeURIComponent(params.db) + '/sql'"
            @click.prevent="navigate('/db/' + encodeURIComponent(params.db) + '/sql')"
            class="btn btn-sm btn-outline">SQL Command</a>
          <a :href="'#/db/' + encodeURIComponent(params.db) + '/dump'"
            @click.prevent="navigate('/db/' + encodeURIComponent(params.db) + '/dump')"
            class="btn btn-sm btn-outline">Export</a>
          <a :href="'#/db/' + encodeURIComponent(params.db) + '/table/new'"
            @click.prevent="navigate('/db/' + encodeURIComponent(params.db) + '/table/new')"
            class="btn btn-sm btn-primary">+ New Table</a>
        </div>
      </div>

      <div v-if="error" class="alert alert-error text-sm">{{ error }}</div>

      <div v-if="loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <template v-else>
        <input v-if="tables.length > 8" v-model="filter" type="text" placeholder="Filter tables…"
          class="input input-bordered input-sm w-full max-w-sm" />

        <div class="overflow-x-auto rounded-lg border border-base-300">
          <table class="table table-sm w-full">
            <thead><tr class="bg-base-200">
              <th>Table</th><th>Type</th><th class="text-right">Actions</th>
            </tr></thead>
            <tbody>
              <tr v-if="!filtered().length">
                <td colspan="3" class="text-center py-8 text-base-content/50">No tables found.</td>
              </tr>
              <tr v-for="t in filtered()" :key="t.name" class="hover">
                <td>
                  <button class="link link-hover font-medium text-sm" @click="openTable(t)">{{ t.name }}</button>
                </td>
                <td><span :class="['badge badge-sm', t.type === 'view' ? 'badge-ghost italic' : 'badge-outline']">{{ t.type }}</span></td>
                <td class="text-right">
                  <div class="flex gap-1 justify-end">
                    <button class="btn btn-ghost btn-xs" @click="openTable(t)" title="Browse">Browse</button>
                    <button class="btn btn-ghost btn-xs" @click="openStructure(t)" title="Structure">Structure</button>
                    <button class="btn btn-ghost btn-xs text-warning" @click="truncateTable(t)" title="Truncate">Truncate</button>
                    <button class="btn btn-ghost btn-xs text-error" @click="dropTable(t)" title="Drop">Drop</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  `,
};
