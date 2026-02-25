import { ref, computed } from 'vue';

export default {
  name: 'DataTable',
  props: {
    rows:       { type: Array,   default: () => [] },
    fields:     { type: Array,   default: () => [] },   // [{ name, type }]
    total:      { type: Number,  default: null },
    limit:      { type: Number,  default: 50 },
    offset:     { type: Number,  default: 0 },
    loading:    { type: Boolean, default: false },
    selectable: { type: Boolean, default: false },
    sortCol:    { type: String,  default: null },
    sortDir:    { type: String,  default: 'ASC' },
    primaryKey: { type: String,  default: null },
    editable:   { type: Boolean, default: false },
    tableRef:   { type: String,  default: '' },
    db:         { type: String,  default: '' },
  },
  emits: ['sort', 'page', 'delete-rows', 'edit-row'],
  setup(props, { emit }) {
    const selected = ref(new Set());
    const allChecked = computed(() => props.rows.length > 0 && selected.value.size === props.rows.length);

    function toggleAll() {
      if (allChecked.value) {
        selected.value = new Set();
      } else {
        selected.value = new Set(props.rows.map((_, i) => i));
      }
    }

    function toggleRow(i) {
      const s = new Set(selected.value);
      if (s.has(i)) s.delete(i); else s.add(i);
      selected.value = s;
    }

    function getSelectedKeys() {
      if (!props.primaryKey) return [];
      return [...selected.value].map(i => props.rows[i]?.[props.primaryKey]);
    }

    function deleteSelected() {
      const keys = getSelectedKeys();
      if (!keys.length) return;
      if (confirm(`Delete ${keys.length} row(s)?`)) {
        emit('delete-rows', keys);
        selected.value = new Set();
      }
    }

    function formatVal(v) {
      if (v === null || v === undefined) return { text: 'NULL', cls: 'text-base-content/40 italic' };
      const s = String(v);
      if (s.length > 200) return { text: s.slice(0, 200) + '…', cls: 'font-mono text-xs' };
      return { text: s, cls: 'font-mono text-xs' };
    }

    const totalPages = computed(() => props.total !== null ? Math.ceil(props.total / props.limit) : null);
    const currentPage = computed(() => Math.floor(props.offset / props.limit) + 1);

    function goPage(page) {
      emit('page', (page - 1) * props.limit);
    }

    function sortBy(col) {
      const dir = props.sortCol === col && props.sortDir === 'ASC' ? 'DESC' : 'ASC';
      emit('sort', { col, dir });
    }

    function editRow(row) {
      emit('edit-row', row);
    }

    return { selected, allChecked, toggleAll, toggleRow, deleteSelected, formatVal, totalPages, currentPage, goPage, sortBy, editRow };
  },
  template: `
    <div class="space-y-2">
      <!-- Toolbar -->
      <div v-if="selectable && selected.size > 0" class="flex gap-2 items-center">
        <span class="text-sm text-base-content/70">{{ selected.size }} selected</span>
        <button class="btn btn-xs btn-error" @click="deleteSelected">Delete selected</button>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-lg border border-base-300">
        <table class="table table-xs table-zebra w-full">
          <thead>
            <tr class="bg-base-200">
              <th v-if="selectable" class="w-8">
                <input type="checkbox" class="checkbox checkbox-xs" :checked="allChecked" @change="toggleAll" />
              </th>
              <th v-for="f in fields" :key="f.name"
                class="cursor-pointer select-none whitespace-nowrap hover:bg-base-300"
                @click="sortBy(f.name)">
                <span class="flex items-center gap-1">
                  {{ f.name }}
                  <span v-if="sortCol === f.name" class="text-primary">{{ sortDir === 'ASC' ? '↑' : '↓' }}</span>
                </span>
              </th>
              <th v-if="editable" class="w-16">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="fields.length + (selectable ? 1 : 0) + (editable ? 1 : 0)" class="text-center py-8">
                <span class="loading loading-spinner loading-md"></span>
              </td>
            </tr>
            <tr v-else-if="!rows.length">
              <td :colspan="fields.length + (selectable ? 1 : 0) + (editable ? 1 : 0)"
                class="text-center py-8 text-base-content/50">No rows found</td>
            </tr>
            <tr v-else v-for="(row, ri) in rows" :key="ri"
              :class="selected.has(ri) ? 'bg-primary/10' : ''">
              <td v-if="selectable">
                <input type="checkbox" class="checkbox checkbox-xs" :checked="selected.has(ri)" @change="toggleRow(ri)" />
              </td>
              <td v-for="f in fields" :key="f.name" class="max-w-xs truncate"
                :title="row[f.name] !== null && row[f.name] !== undefined ? String(row[f.name]) : 'NULL'">
                <span :class="formatVal(row[f.name]).cls">{{ formatVal(row[f.name]).text }}</span>
              </td>
              <td v-if="editable">
                <button class="btn btn-ghost btn-xs" @click="editRow(row)" title="Edit">✏️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between text-sm">
        <span class="text-base-content/60">
          Rows {{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}
        </span>
        <div class="join">
          <button class="join-item btn btn-xs" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">«</button>
          <button class="join-item btn btn-xs btn-disabled" v-if="currentPage > 3">…</button>
          <button v-for="p in pageRange" :key="p" class="join-item btn btn-xs"
            :class="p === currentPage ? 'btn-primary' : ''" @click="goPage(p)">{{ p }}</button>
          <button class="join-item btn btn-xs btn-disabled" v-if="totalPages > currentPage + 2">…</button>
          <button class="join-item btn btn-xs" :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">»</button>
        </div>
      </div>
    </div>
  `,
  computed: {
    pageRange() {
      const total = this.totalPages || 1;
      const cur = this.currentPage;
      const range = [];
      for (let p = Math.max(1, cur - 2); p <= Math.min(total, cur + 2); p++) range.push(p);
      return range;
    },
  },
};
