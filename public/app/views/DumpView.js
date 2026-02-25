import { ref, inject, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  name: 'DumpView',
  props: { params: { type: Object, default: () => ({}) } },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');

    const tables = ref([]);
    const loading = ref(true);
    const selected = ref(new Set());
    const format = ref('sql');
    const includeStructure = ref(true);
    const includeData = ref(true);

    onMounted(async () => {
      const { data, error } = await api.tables(props.params.db);
      loading.value = false;
      if (error) { store.error(error); return; }
      tables.value = data?.tables || [];
      selected.value = new Set(tables.value.map(t => t.name));
    });

    function toggleAll() {
      if (selected.value.size === tables.value.length) selected.value = new Set();
      else selected.value = new Set(tables.value.map(t => t.name));
    }

    function toggle(name) {
      const s = new Set(selected.value);
      if (s.has(name)) s.delete(name); else s.add(name);
      selected.value = s;
    }

    function buildUrl() {
      const tableList = [...selected.value].join(',');
      const params = new URLSearchParams({
        db: props.params.db || '',
        format: format.value,
        tables: tableList,
        structure: includeStructure.value ? '1' : '0',
        data: includeData.value ? '1' : '0',
      });
      return `/api/dump?${params}`;
    }

    function download() {
      window.open(buildUrl(), '_blank');
    }

    return { store, navigate, tables, loading, selected, format, includeStructure, includeData, toggleAll, toggle, download };
  },
  template: `
    <div class="max-w-2xl space-y-6">
      <h2 class="text-xl font-bold">Export — {{ params.db }}</h2>

      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body gap-4">

          <!-- Format -->
          <div class="form-control">
            <label class="label pb-1"><span class="label-text font-medium">Format</span></label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="format" value="sql" class="radio radio-sm" /> SQL
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="format" value="csv" class="radio radio-sm" /> CSV (single table)
              </label>
            </div>
          </div>

          <!-- Options -->
          <div class="form-control">
            <label class="label pb-1"><span class="label-text font-medium">Include</span></label>
            <div class="flex gap-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="includeStructure" class="checkbox checkbox-sm" /> Structure (CREATE TABLE)
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="includeData" class="checkbox checkbox-sm" /> Data (INSERT INTO)
              </label>
            </div>
          </div>

          <!-- Table selection -->
          <div class="form-control">
            <label class="label pb-1 flex justify-between">
              <span class="label-text font-medium">Tables</span>
              <button class="btn btn-xs btn-ghost" @click="toggleAll">
                {{ selected.size === tables.length ? 'Deselect All' : 'Select All' }}
              </button>
            </label>
            <div v-if="loading" class="flex justify-center py-4">
              <span class="loading loading-spinner loading-sm"></span>
            </div>
            <div v-else class="max-h-64 overflow-y-auto border border-base-300 rounded-lg divide-y divide-base-200">
              <label v-for="t in tables" :key="t.name" class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-base-200">
                <input type="checkbox" class="checkbox checkbox-sm"
                  :checked="selected.has(t.name)" @change="toggle(t.name)" />
                <span class="text-sm font-mono">{{ t.name }}</span>
                <span class="badge badge-xs badge-ghost ml-auto">{{ t.type }}</span>
              </label>
            </div>
          </div>

          <button class="btn btn-primary" :disabled="selected.size === 0" @click="download">
            ⬇ Download Export
          </button>
        </div>
      </div>
    </div>
  `,
};
