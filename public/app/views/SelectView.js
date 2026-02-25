import { ref, inject, onMounted, watch, computed } from 'vue';
import { api } from '../api.js';
import DataTable from '../components/DataTable.js';

export default {
  name: 'SelectView',
  components: { DataTable },
  props: { params: { type: Object, default: () => ({}) } },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');

    const rows = ref([]);
    const fields = ref([]);
    const total = ref(null);
    const limit = ref(50);
    const offset = ref(0);
    const sortCol = ref(null);
    const sortDir = ref('ASC');
    const loading = ref(true);
    const error = ref('');
    const primaryKey = ref(null);
    const whereInputs = ref([{ col: '', op: '=', val: '' }]);

    async function loadStructure() {
      const { db, table } = props.params;
      if (!db || !table) return;
      const { data } = await api.tableStructure(table, db);
      if (data?.fields) {
        // Find primary key
        const pk = data.fields.find(f => f.primary);
        primaryKey.value = pk?.name || null;
      }
    }

    async function load() {
      const { db, table } = props.params;
      if (!db || !table) return;
      store.setTable(table);
      loading.value = true;
      error.value = '';

      const params = { db, limit: limit.value, offset: offset.value };
      if (sortCol.value) { params.order = sortCol.value; params.dir = sortDir.value; }

      // Build where object
      const activeWhere = whereInputs.value.filter(w => w.col && w.val !== '');
      if (activeWhere.length) {
        params.where = {};
        for (const w of activeWhere) {
          params.where[w.col] = { [w.op]: w.val };
        }
      }

      const { data, error: err } = await api.select(table, params);
      loading.value = false;
      if (err) { error.value = err; return; }
      rows.value = data?.rows || [];
      fields.value = data?.fields || [];
      total.value = data?.total ?? null;
    }

    onMounted(async () => { await loadStructure(); await load(); });
    watch(() => props.params.table, async () => { offset.value = 0; await loadStructure(); await load(); });

    function onSort({ col, dir }) {
      sortCol.value = col; sortDir.value = dir; offset.value = 0; load();
    }

    function onPage(off) { offset.value = off; load(); }

    async function onDeleteRows(keys) {
      const { error: err } = await api.bulkDelete(props.params.table, {
        action: 'delete', rows: keys, primaryKey: primaryKey.value,
      });
      if (err) { store.error(err); return; }
      store.success(`${keys.length} row(s) deleted`);
      load();
    }

    function onEditRow(row) {
      if (!primaryKey.value) return;
      const pkVal = row[primaryKey.value];
      navigate(`/db/${encodeURIComponent(props.params.db)}/table/${encodeURIComponent(props.params.table)}/edit?pk=${encodeURIComponent(pkVal)}`);
    }

    function addWhereRow() { whereInputs.value.push({ col: '', op: '=', val: '' }); }
    function removeWhereRow(i) { whereInputs.value.splice(i, 1); }
    function applyFilter() { offset.value = 0; load(); }

    const fieldNames = computed(() => fields.value.map(f => f.name));
    const operators = computed(() => store.driverConfig?.operators || ['=','<','>','LIKE','IS NULL','IS NOT NULL']);

    return { store, navigate, rows, fields, total, limit, offset, sortCol, sortDir, loading, error, primaryKey,
      whereInputs, onSort, onPage, onDeleteRows, onEditRow, addWhereRow, removeWhereRow, applyFilter, fieldNames, operators };
  },
  template: `
    <div class="space-y-4 max-w-full">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <h2 class="text-xl font-bold">{{ params.table }}</h2>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-sm btn-outline"
            @click="navigate('/db/' + encodeURIComponent(params.db) + '/table/' + encodeURIComponent(params.table))">
            Structure
          </button>
          <button class="btn btn-sm btn-primary"
            @click="navigate('/db/' + encodeURIComponent(params.db) + '/table/' + encodeURIComponent(params.table) + '/insert')">
            + Insert Row
          </button>
          <a class="btn btn-sm btn-outline" :href="'/api/dump?tables=' + encodeURIComponent(params.table) + '&db=' + encodeURIComponent(params.db)" target="_blank">Export</a>
        </div>
      </div>

      <!-- Filters -->
      <details class="bg-base-100 border border-base-300 rounded-lg">
        <summary class="px-4 py-2 cursor-pointer text-sm font-medium select-none">Filters</summary>
        <div class="p-4 space-y-2">
          <div v-for="(w, i) in whereInputs" :key="i" class="flex gap-2 items-center flex-wrap">
            <select v-model="w.col" class="select select-xs select-bordered w-36">
              <option value="">— column —</option>
              <option v-for="f in fieldNames" :key="f" :value="f">{{ f }}</option>
            </select>
            <select v-model="w.op" class="select select-xs select-bordered w-32">
              <option v-for="op in operators" :key="op" :value="op">{{ op }}</option>
            </select>
            <input v-if="!w.op.includes('NULL')" v-model="w.val" type="text"
              placeholder="value" class="input input-xs input-bordered flex-1 min-w-24 font-mono" />
            <button class="btn btn-ghost btn-xs text-error" @click="removeWhereRow(i)">✕</button>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-xs btn-ghost" @click="addWhereRow">+ Add filter</button>
            <button class="btn btn-xs btn-primary" @click="applyFilter">Apply</button>
          </div>
        </div>
      </details>

      <div v-if="error" class="alert alert-error text-sm">{{ error }}</div>

      <DataTable
        :rows="rows" :fields="fields" :total="total" :limit="limit" :offset="offset"
        :loading="loading" :selectable="!!primaryKey" :sortCol="sortCol" :sortDir="sortDir"
        :primaryKey="primaryKey" :editable="!!primaryKey"
        @sort="onSort" @page="onPage" @delete-rows="onDeleteRows" @edit-row="onEditRow"
      />
    </div>
  `,
};
