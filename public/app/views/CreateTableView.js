import { ref, inject, computed } from 'vue';
import { api } from '../api.js';

const DEFAULT_TYPES = ['int','bigint','varchar','text','boolean','decimal','float','date','datetime','timestamp','json','blob'];

function newField(name = '', type = 'varchar') {
  return { name, type, length: type === 'varchar' ? '255' : '', nullable: true, default: '', autoIncrement: false, primary: false, unsigned: false, comment: '' };
}

export default {
  name: 'CreateTableView',
  props: { params: { type: Object, default: () => ({}) } },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');

    const tableName = ref('');
    const fields = ref([newField('id', 'int'), newField('', 'varchar')]);
    const loading = ref(false);
    const error = ref('');

    // Set first field as primary/AI by default
    fields.value[0].primary = true;
    fields.value[0].autoIncrement = true;
    fields.value[0].nullable = false;

    const types = computed(() => store.driverConfig?.types
      ? Object.values(store.driverConfig.types).flat()
      : DEFAULT_TYPES);

    function addField() { fields.value.push(newField()); }
    function removeField(i) { if (fields.value.length > 1) fields.value.splice(i, 1); }
    function moveUp(i) { if (i > 0) fields.value.splice(i - 1, 0, fields.value.splice(i, 1)[0]); }
    function moveDown(i) { if (i < fields.value.length - 1) fields.value.splice(i + 1, 0, fields.value.splice(i, 1)[0]); }

    function onTypeChange(f) {
      if (['int','bigint','tinyint','smallint','mediumint','integer','serial'].includes(f.type)) f.length = '';
      else if (['varchar','char'].includes(f.type)) f.length = f.length || '255';
    }

    async function create() {
      if (!tableName.value.trim()) { error.value = 'Table name is required'; return; }
      const invalid = fields.value.filter(f => !f.name.trim());
      if (invalid.length) { error.value = 'All fields must have a name'; return; }

      const fieldDefs = fields.value.map(f => ({
        name: f.name.trim(),
        type: f.type,
        fullType: f.length ? `${f.type}(${f.length})` : f.type,
        nullable: f.nullable && !f.primary,
        default: f.default || null,
        autoIncrement: f.autoIncrement,
        primary: f.primary,
        unsigned: f.unsigned,
        comment: f.comment,
      }));

      // Build index for primary key
      const pkFields = fields.value.filter(f => f.primary).map(f => f.name.trim());
      const indexes = pkFields.length ? [{ type: 'PRIMARY', name: 'PRIMARY', columns: pkFields }] : [];

      loading.value = true;
      error.value = '';
      const { data, error: err } = await api.createTable({ name: tableName.value.trim(), fields: fieldDefs, indexes }, props.params.db);
      loading.value = false;
      if (err) { error.value = err; return; }
      store.success(`Table "${tableName.value}" created`);
      navigate(`/db/${encodeURIComponent(props.params.db)}/table/${encodeURIComponent(tableName.value)}/select`);
    }

    return { store, navigate, tableName, fields, types, loading, error, addField, removeField, moveUp, moveDown, onTypeChange, create };
  },
  template: `
    <div class="max-w-4xl space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">Create Table — {{ params.db }}</h2>
        <button class="btn btn-sm btn-ghost" @click="navigate('/db/' + encodeURIComponent(params.db))">← Back</button>
      </div>

      <div v-if="error" class="alert alert-error text-sm py-2">{{ error }}</div>

      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body gap-4">
          <div class="form-control">
            <label class="label pb-1"><span class="label-text font-medium">Table Name</span></label>
            <input v-model="tableName" type="text" placeholder="users" class="input input-bordered w-full max-w-sm" autofocus />
          </div>

          <!-- Fields -->
          <div class="overflow-x-auto">
            <table class="table table-sm w-full">
              <thead><tr class="bg-base-200">
                <th class="w-6">#</th>
                <th>Name</th><th>Type</th><th>Length</th>
                <th class="w-12">NULL</th><th class="w-12">PK</th><th class="w-12">AI</th>
                <th>Default</th><th class="w-20">Actions</th>
              </tr></thead>
              <tbody>
                <tr v-for="(f, i) in fields" :key="i">
                  <td class="text-base-content/40 text-xs">{{ i + 1 }}</td>
                  <td><input v-model="f.name" type="text" placeholder="column_name" class="input input-xs input-bordered w-32 font-mono" /></td>
                  <td>
                    <select v-model="f.type" class="select select-xs select-bordered w-28 font-mono" @change="onTypeChange(f)">
                      <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
                    </select>
                  </td>
                  <td><input v-model="f.length" type="text" placeholder="255" class="input input-xs input-bordered w-16 font-mono" /></td>
                  <td class="text-center"><input type="checkbox" v-model="f.nullable" class="checkbox checkbox-xs" :disabled="f.primary" /></td>
                  <td class="text-center"><input type="checkbox" v-model="f.primary" class="checkbox checkbox-xs" @change="if(f.primary){f.nullable=false}" /></td>
                  <td class="text-center"><input type="checkbox" v-model="f.autoIncrement" class="checkbox checkbox-xs" :disabled="!f.primary" /></td>
                  <td><input v-model="f.default" type="text" placeholder="NULL" class="input input-xs input-bordered w-20 font-mono" /></td>
                  <td>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-xs" :disabled="i === 0" @click="moveUp(i)">↑</button>
                      <button class="btn btn-ghost btn-xs" :disabled="i === fields.length - 1" @click="moveDown(i)">↓</button>
                      <button class="btn btn-ghost btn-xs text-error" :disabled="fields.length <= 1" @click="removeField(i)">✕</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <button class="btn btn-sm btn-ghost w-fit" @click="addField">+ Add Column</button>

          <div class="card-actions justify-end border-t border-base-300 pt-3">
            <button class="btn btn-ghost" @click="navigate('/db/' + encodeURIComponent(params.db))">Cancel</button>
            <button class="btn btn-primary" :class="loading ? 'btn-disabled' : ''" @click="create">
              <span v-if="loading" class="loading loading-spinner loading-sm"></span>
              Create Table
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
