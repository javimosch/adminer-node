import { ref, inject, onMounted, watch } from 'vue';
import { api } from '../api.js';

export default {
  name: 'TableStructureView',
  props: { params: { type: Object, default: () => ({}) } },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');
    const fields = ref([]);
    const indexes = ref([]);
    const foreignKeys = ref([]);
    const ddl = ref('');
    const loading = ref(true);
    const error = ref('');
    const showDdl = ref(false);

    async function load() {
      const { db, table } = props.params;
      if (!db || !table) return;
      store.setTable(table);
      loading.value = true;
      const [strRes, ddlRes] = await Promise.all([
        api.tableStructure(table, db),
        api.tableSql(table, db),
      ]);
      loading.value = false;
      if (strRes.error) { error.value = strRes.error; return; }
      fields.value = strRes.data?.fields || [];
      indexes.value = strRes.data?.indexes || [];
      foreignKeys.value = strRes.data?.foreignKeys || [];
      ddl.value = ddlRes.data?.sql || '';
    }

    onMounted(load);
    watch(() => props.params.table, load);

    return { store, navigate, fields, indexes, foreignKeys, ddl, loading, error, showDdl };
  },
  template: `
    <div class="space-y-6 max-w-5xl">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">{{ params.table }}</h2>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-outline"
            @click="navigate('/db/' + encodeURIComponent(params.db) + '/table/' + encodeURIComponent(params.table) + '/select')">
            Browse
          </button>
          <button class="btn btn-sm btn-primary"
            @click="navigate('/db/' + encodeURIComponent(params.db) + '/table/' + encodeURIComponent(params.table) + '/insert')">
            + Insert Row
          </button>
        </div>
      </div>

      <div v-if="error" class="alert alert-error text-sm">{{ error }}</div>
      <div v-if="loading" class="flex justify-center py-12"><span class="loading loading-spinner loading-lg text-primary"></span></div>

      <template v-else>
        <!-- Fields -->
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-0">
            <div class="px-4 py-3 border-b border-base-300 font-semibold text-sm">Columns ({{ fields.length }})</div>
            <div class="overflow-x-auto">
              <table class="table table-xs w-full">
                <thead><tr class="bg-base-200">
                  <th>#</th><th>Name</th><th>Type</th><th>Null</th><th>Default</th><th>Key</th><th>Extra</th>
                </tr></thead>
                <tbody>
                  <tr v-for="(f, i) in fields" :key="f.name" class="hover">
                    <td class="text-base-content/40 text-xs">{{ i + 1 }}</td>
                    <td class="font-mono font-medium text-sm">
                      <span :class="f.primary ? 'text-primary' : ''">{{ f.name }}</span>
                    </td>
                    <td><span class="badge badge-outline badge-sm font-mono">{{ f.fullType || f.type }}</span></td>
                    <td><span :class="['badge badge-xs', f.nullable ? 'badge-ghost' : 'badge-neutral']">{{ f.nullable ? 'YES' : 'NO' }}</span></td>
                    <td class="font-mono text-xs text-base-content/70">{{ f.default ?? '—' }}</td>
                    <td>
                      <span v-if="f.primary" class="badge badge-primary badge-xs">PK</span>
                      <span v-else-if="f.autoIncrement" class="badge badge-info badge-xs">AI</span>
                    </td>
                    <td class="text-xs text-base-content/60">{{ f.autoIncrement ? 'AUTO_INCREMENT' : '' }}{{ f.comment ? '💬' : '' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Indexes -->
        <div v-if="indexes.length" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-0">
            <div class="px-4 py-3 border-b border-base-300 font-semibold text-sm">Indexes ({{ indexes.length }})</div>
            <div class="overflow-x-auto">
              <table class="table table-xs w-full">
                <thead><tr class="bg-base-200"><th>Name</th><th>Type</th><th>Columns</th></tr></thead>
                <tbody>
                  <tr v-for="idx in indexes" :key="idx.name" class="hover">
                    <td class="font-mono text-sm">{{ idx.name }}</td>
                    <td><span class="badge badge-outline badge-sm">{{ idx.type }}</span></td>
                    <td class="font-mono text-xs">{{ idx.columns.join(', ') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Foreign Keys -->
        <div v-if="foreignKeys.length" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-0">
            <div class="px-4 py-3 border-b border-base-300 font-semibold text-sm">Foreign Keys ({{ foreignKeys.length }})</div>
            <div class="overflow-x-auto">
              <table class="table table-xs w-full">
                <thead><tr class="bg-base-200"><th>Name</th><th>Source</th><th>Target</th><th>On Delete</th></tr></thead>
                <tbody>
                  <tr v-for="fk in foreignKeys" :key="fk.name" class="hover">
                    <td class="font-mono text-xs">{{ fk.name }}</td>
                    <td class="font-mono text-xs">{{ fk.sourceColumns.join(', ') }}</td>
                    <td class="font-mono text-xs">{{ fk.targetTable }}.{{ fk.targetColumns.join(', ') }}</td>
                    <td><span class="badge badge-ghost badge-xs">{{ fk.onDelete }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- DDL -->
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body py-3">
            <button class="text-sm font-semibold flex items-center gap-1 w-fit" @click="showDdl = !showDdl">
              <span>{{ showDdl ? '▼' : '▶' }}</span> Show CREATE statement
            </button>
            <pre v-if="showDdl" class="mt-2 bg-base-200 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{{ ddl }}</pre>
          </div>
        </div>
      </template>
    </div>
  `,
};
