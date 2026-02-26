import { ref, inject, watch, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  name: 'Sidebar',
  props: {
    params: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');

    const databases = ref([]);
    const tables = ref([]);
    const loadingDbs = ref(false);
    const loadingTables = ref(false);
    const dbFilter = ref('');
    const tableFilter = ref('');

    async function loadDatabases() {
      if (!store.conn?.driver) return;
      // SQLite doesn't have multiple databases
      if (store.conn.driver === 'sqlite') {
        databases.value = [store.conn.server || ':memory:'];
        return;
      }
      loadingDbs.value = true;
      const { data, error } = await api.databases();
      loadingDbs.value = false;
      if (error) return store.error(error);
      databases.value = data?.databases || [];
    }

    async function loadTables(db) {
      if (!db) { tables.value = []; return; }
      loadingTables.value = true;
      const { data, error } = await api.tables(db);
      loadingTables.value = false;
      if (error) return store.error(error);
      tables.value = data?.tables || [];
    }

    function selectDb(db) {
      store.setDb(db);
      navigate(`/db/${encodeURIComponent(db)}`);
    }

    function selectTable(table) {
      store.setTable(table.name);
      navigate(`/db/${encodeURIComponent(store.currentDb)}/table/${encodeURIComponent(table.name)}/select`);
    }

    onMounted(async () => {
      await loadDatabases();
      if (props.params.db) await loadTables(props.params.db);
    });

    watch(() => props.params.db, async (db) => {
      if (db) await loadTables(db);
      else tables.value = [];
    });

    const filteredDbs = () => databases.value.filter(d => !dbFilter.value || d.toLowerCase().includes(dbFilter.value.toLowerCase()));
    const filteredTables = () => tables.value.filter(t => !tableFilter.value || t.name.toLowerCase().includes(tableFilter.value.toLowerCase()));

    return { store, navigate, databases, tables, loadingDbs, loadingTables, dbFilter, tableFilter, selectDb, selectTable, filteredDbs, filteredTables };
  },
  template: `
    <nav class="p-2 space-y-1">
      <!-- Global links -->
      <ul class="menu menu-sm w-full">
        <li><a @click.prevent="navigate('/home')" href="#/home" class="text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          Home
        </a></li>
        <li><a @click.prevent="navigate('/databases')" href="#/databases" class="text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/></svg>
          Server Info
        </a></li>
        <li v-if="store.conn?.driver !== 'sqlite'">
          <a @click.prevent="navigate('/db')" href="#/db" class="text-sm">+ New Database</a>
        </li>
        <li v-if="store.conn?.driver === 'mysql'">
          <a @click.prevent="navigate('/users')" href="#/users" class="text-sm">Users & Privileges</a>
        </li>
        <li><a @click.prevent="navigate('/variables')" href="#/variables" class="text-sm">Variables</a></li>
      </ul>

      <div class="divider my-1 text-xs">Databases</div>

      <!-- DB filter -->
      <input v-if="databases.length > 6" v-model="dbFilter" type="text" placeholder="Filter databases…"
        class="input input-xs input-bordered w-full mb-1" />

      <!-- Database list -->
      <div v-if="loadingDbs" class="text-center py-2">
        <span class="loading loading-spinner loading-xs"></span>
      </div>
      <ul v-else class="menu menu-xs w-full">
        <li v-for="db in filteredDbs()" :key="db">
          <a @click.prevent="selectDb(db)" :href="'#/db/' + encodeURIComponent(db)"
            :class="['text-sm truncate', store.currentDb === db ? 'active font-semibold' : '']">
            {{ db }}
          </a>
        </li>
      </ul>

      <!-- Tables in current DB -->
      <template v-if="store.currentDb && tables.length">
        <div class="divider my-1 text-xs">Tables</div>
        <input v-if="tables.length > 8" v-model="tableFilter" type="text" placeholder="Filter tables…"
          class="input input-xs input-bordered w-full mb-1" />
        <div v-if="loadingTables" class="text-center py-2">
          <span class="loading loading-spinner loading-xs"></span>
        </div>
        <ul v-else class="menu menu-xs w-full">
          <li v-for="t in filteredTables()" :key="t.name">
            <a @click.prevent="selectTable(t)" :href="'#/db/' + encodeURIComponent(store.currentDb) + '/table/' + encodeURIComponent(t.name) + '/select'"
              :class="['text-sm truncate', store.currentTable === t.name ? 'active' : '']">
              <span :class="t.type === 'view' ? 'italic text-base-content/70' : ''">{{ t.name }}</span>
            </a>
          </li>
        </ul>

        <!-- DB-level actions -->
        <div class="mt-2 px-1 space-y-1">
          <a :href="'#/db/' + encodeURIComponent(store.currentDb) + '/sql'" @click.prevent="navigate('/db/' + encodeURIComponent(store.currentDb) + '/sql')"
            class="btn btn-xs btn-outline w-full">SQL Command</a>
          <a :href="'#/db/' + encodeURIComponent(store.currentDb) + '/dump'" @click.prevent="navigate('/db/' + encodeURIComponent(store.currentDb) + '/dump')"
            class="btn btn-xs btn-outline w-full">Export</a>
          <a :href="'#/db/' + encodeURIComponent(store.currentDb) + '/table/new'" @click.prevent="navigate('/db/' + encodeURIComponent(store.currentDb) + '/table/new')"
            class="btn btn-xs btn-primary w-full">+ New Table</a>
        </div>
      </template>
    </nav>
  `,
};
