import { ref, inject, onMounted, nextTick } from 'vue';
import { api } from '../api.js';
import SqlEditor from '../components/SqlEditor.js';
import DataTable from '../components/DataTable.js';

export default {
  name: 'SqlView',
  components: { SqlEditor, DataTable },
  props: { params: { type: Object, default: () => ({}) } },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');

    const sql = ref('');
    const results = ref([]);
    const loading = ref(false);
    const error = ref('');
    const history = ref([]);
    const HISTORY_KEY = 'adminer_sql_history';
    const limit = ref(1000);

    onMounted(() => {
      try { history.value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch {}
      // Pre-fill from URL hash ?sql=...
      const m = window.location.hash.match(/\?sql=([^&]+)/);
      if (m) sql.value = decodeURIComponent(m[1]);
    });

    async function run() {
      if (!sql.value.trim()) return;
      loading.value = true;
      error.value = '';
      results.value = [];

      // Save to history
      const trimmed = sql.value.trim();
      history.value = [trimmed, ...history.value.filter(h => h !== trimmed)].slice(0, 50);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value)); } catch {}

      const { data, error: err } = await api.sql({ sql: trimmed, db: props.params.db, limit: limit.value });
      loading.value = false;
      if (err) { error.value = err; return; }
      results.value = data?.results || [];
    }

    function loadHistory(h) { sql.value = h; }

    function clearHistory() {
      history.value = [];
      try { localStorage.removeItem(HISTORY_KEY); } catch {}
    }

    function formatTime(ms) {
      if (ms < 1000) return `${ms}ms`;
      return `${(ms / 1000).toFixed(2)}s`;
    }

    return { store, navigate, sql, results, loading, error, history, limit, run, loadHistory, clearHistory, formatTime };
  },
  template: `
    <div class="space-y-4 max-w-5xl">
      <h2 class="text-xl font-bold">SQL Command — {{ params.db }}</h2>

      <!-- Editor -->
      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body gap-3">
          <SqlEditor v-model="sql" :rows="10" placeholder="SELECT * FROM users LIMIT 10;" @run="run" />
          <div class="flex gap-2 items-center">
            <button class="btn btn-primary btn-sm" :class="loading ? 'btn-disabled' : ''" @click="run">
              <span v-if="loading" class="loading loading-spinner loading-xs"></span>
              Run <kbd class="kbd kbd-xs ml-1">Ctrl+Enter</kbd>
            </button>
            <label class="flex items-center gap-1 text-sm text-base-content/60">
              Limit: <input v-model.number="limit" type="number" min="1" max="10000" class="input input-xs input-bordered w-20" />
            </label>
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-error text-sm">{{ error }}</div>

      <!-- Results -->
      <div v-for="(result, i) in results" :key="i" class="space-y-2">
        <!-- Error result -->
        <div v-if="result.error" class="alert alert-error text-sm">
          <span class="font-mono">{{ result.error }}</span>
          <span class="ml-2 text-xs opacity-70">({{ formatTime(result.time) }})</span>
        </div>

        <!-- Row result -->
        <div v-else-if="result.rows.length > 0" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-0">
            <div class="px-4 py-2 border-b border-base-300 text-xs text-base-content/60 flex justify-between">
              <span>{{ result.rows.length }} row(s)</span>
              <span>{{ formatTime(result.time) }}</span>
            </div>
            <DataTable :rows="result.rows" :fields="result.fields" :loading="false" />
          </div>
        </div>

        <!-- Success (no rows) -->
        <div v-else class="alert alert-success text-sm py-2">
          <span>Query OK — {{ result.rowsAffected }} row(s) affected</span>
          <span class="ml-auto text-xs opacity-70">{{ formatTime(result.time) }}</span>
        </div>
      </div>

      <!-- History -->
      <details v-if="history.length" class="bg-base-100 border border-base-300 rounded-lg">
        <summary class="px-4 py-2 cursor-pointer text-sm font-medium select-none flex justify-between">
          <span>History ({{ history.length }})</span>
        </summary>
        <div class="p-3 space-y-1 max-h-64 overflow-y-auto">
          <div v-for="(h, i) in history" :key="i"
            class="flex items-start gap-2 group hover:bg-base-200 rounded p-1 cursor-pointer"
            @click="loadHistory(h)">
            <code class="text-xs font-mono flex-1 truncate text-base-content/80">{{ h }}</code>
          </div>
          <button class="btn btn-xs btn-ghost text-error mt-2" @click="clearHistory">Clear history</button>
        </div>
      </details>
    </div>
  `,
};
