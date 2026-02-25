import { ref, inject, onMounted, computed, watch } from 'vue';
import { api } from '../api.js';
import FieldInput from '../components/FieldInput.js';

export default {
  name: 'EditView',
  components: { FieldInput },
  props: { params: { type: Object, default: () => ({}) } },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');

    const fields = ref([]);
    const formData = ref({});
    const loading = ref(true);
    const saving = ref(false);
    const error = ref('');
    const isInsert = computed(() => {
      const hash = window.location.hash;
      return hash.includes('/insert') || !getPkValue();
    });

    function getPkValue() {
      const hash = window.location.hash;
      const m = hash.match(/[?&]pk=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    }

    async function load() {
      const { db, table } = props.params;
      if (!db || !table) return;
      store.setTable(table);
      loading.value = true;
      error.value = '';

      const pkVal = getPkValue();
      const whereParam = {};
      let pkField = null;

      // Get fields first
      const strRes = await api.tableStructure(table, db);
      if (strRes.error) { error.value = strRes.error; loading.value = false; return; }
      fields.value = (strRes.data?.fields || []).filter(f => !f.generated);
      pkField = fields.value.find(f => f.primary);

      if (!isInsert.value && pkField && pkVal) {
        whereParam.where = { [pkField.name]: pkVal };
        const rowRes = await api.getRow(table, { db, ...whereParam });
        if (rowRes.error) { error.value = rowRes.error; loading.value = false; return; }
        // Populate form with existing row data
        const row = rowRes.data?.row || {};
        formData.value = Object.fromEntries(fields.value.map(f => [f.name, row[f.name] ?? f.default ?? null]));
      } else {
        // Initialize with defaults
        formData.value = Object.fromEntries(fields.value.map(f => [f.name, f.autoIncrement ? null : (f.default ?? null)]));
      }

      loading.value = false;
    }

    onMounted(load);
    watch(() => props.params.table, load);

    async function save() {
      const { db, table } = props.params;
      saving.value = true;
      error.value = '';

      // Filter out null auto-increment fields for insert
      const data = {};
      for (const f of fields.value) {
        if (isInsert.value && f.autoIncrement && formData.value[f.name] === null) continue;
        data[f.name] = formData.value[f.name];
      }

      let result;
      if (isInsert.value) {
        result = await api.insertRow(table, { data });
      } else {
        const pkField = fields.value.find(f => f.primary);
        const pkVal = getPkValue();
        if (!pkField || !pkVal) { error.value = 'Cannot update: no primary key'; saving.value = false; return; }
        const where = [{ col: pkField.name, op: '=', val: pkVal }];
        const updateData = { ...data };
        delete updateData[pkField.name];
        result = await api.updateRow(table, { data: updateData, where });
      }

      saving.value = false;
      if (result.error) { error.value = result.error; return; }
      store.success(isInsert.value ? 'Row inserted' : 'Row updated');
      navigate(`/db/${encodeURIComponent(db)}/table/${encodeURIComponent(table)}/select`);
    }

    async function deleteRow() {
      const { db, table } = props.params;
      const pkField = fields.value.find(f => f.primary);
      const pkVal = getPkValue();
      if (!pkField || !pkVal) return;
      if (!confirm('Delete this row?')) return;
      const { error: err } = await api.deleteRow(table, { where: [{ col: pkField.name, op: '=', val: pkVal }] });
      if (err) { error.value = err; return; }
      store.success('Row deleted');
      navigate(`/db/${encodeURIComponent(db)}/table/${encodeURIComponent(table)}/select`);
    }

    return { store, navigate, fields, formData, loading, saving, error, isInsert, save, deleteRow };
  },
  template: `
    <div class="max-w-2xl space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">{{ isInsert ? 'Insert Row' : 'Edit Row' }} — {{ params.table }}</h2>
        <button class="btn btn-sm btn-ghost"
          @click="navigate('/db/' + encodeURIComponent(params.db) + '/table/' + encodeURIComponent(params.table) + '/select')">
          ← Back
        </button>
      </div>

      <div v-if="error" class="alert alert-error text-sm py-2">{{ error }}</div>
      <div v-if="loading" class="flex justify-center py-12"><span class="loading loading-spinner loading-lg text-primary"></span></div>

      <template v-else>
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body gap-3">
            <div v-for="f in fields" :key="f.name" class="form-control">
              <label class="label py-1">
                <span class="label-text font-medium font-mono text-sm">
                  {{ f.name }}
                  <span class="badge badge-xs badge-outline ml-1 font-normal">{{ f.fullType || f.type }}</span>
                  <span v-if="f.primary" class="badge badge-xs badge-primary ml-1">PK</span>
                  <span v-if="f.autoIncrement" class="badge badge-xs badge-info ml-1">AI</span>
                </span>
              </label>
              <FieldInput :field="f" v-model="formData[f.name]"
                :disabled="!isInsert && f.primary" />
              <div v-if="f.comment" class="label-text-alt text-xs text-base-content/50 mt-1">{{ f.comment }}</div>
            </div>
          </div>
        </div>

        <div class="flex gap-2 justify-between">
          <button v-if="!isInsert" class="btn btn-error btn-sm" @click="deleteRow">Delete Row</button>
          <div class="flex gap-2 ml-auto">
            <button class="btn btn-ghost btn-sm"
              @click="navigate('/db/' + encodeURIComponent(params.db) + '/table/' + encodeURIComponent(params.table) + '/select')">
              Cancel
            </button>
            <button class="btn btn-primary btn-sm" :class="saving ? 'btn-disabled' : ''" @click="save">
              <span v-if="saving" class="loading loading-spinner loading-xs"></span>
              {{ isInsert ? 'Insert' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </template>
    </div>
  `,
};
