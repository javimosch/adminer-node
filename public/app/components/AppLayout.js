import { inject, computed } from 'vue';
import Sidebar from './Sidebar.js';
import Breadcrumb from './Breadcrumb.js';

export default {
  name: 'AppLayout',
  components: { Sidebar, Breadcrumb },
  props: {
    params: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const store = inject('store');
    const navigate = inject('navigate');

    const breadcrumbs = computed(() => {
      const crumbs = [];
      const conn = store.conn;
      if (conn) {
        crumbs.push({ label: conn.driver.toUpperCase(), path: '/databases' });
        if (conn.server) crumbs.push({ label: conn.server, path: '/databases' });
        if (props.params.db) crumbs.push({ label: props.params.db, path: `/db/${encodeURIComponent(props.params.db)}` });
        if (props.params.table) crumbs.push({ label: props.params.table, path: `/db/${encodeURIComponent(props.params.db)}/table/${encodeURIComponent(props.params.table)}` });
      }
      return crumbs;
    });

    async function logout() {
      const { api } = await import('../api.js');
      await api.logout();
      store.clearAuth();
      navigate('/login');
    }

    return { store, breadcrumbs, logout };
  },
  template: `
    <div class="drawer lg:drawer-open min-h-screen">
      <input id="sidebar-toggle" type="checkbox" class="drawer-toggle" />
      <!-- Page content -->
      <div class="drawer-content flex flex-col">
        <!-- Top navbar (mobile) -->
        <div class="navbar bg-base-200 lg:hidden sticky top-0 z-30 shadow-sm">
          <label for="sidebar-toggle" class="btn btn-ghost drawer-button">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </label>
          <span class="font-bold text-lg ml-2">🗄️ Adminer Node</span>
        </div>

        <!-- Breadcrumb + content area -->
        <main class="flex-1 p-4 lg:p-6 overflow-auto">
          <Breadcrumb :crumbs="breadcrumbs" class="mb-4" />
          <slot />
        </main>
      </div>

      <!-- Sidebar -->
      <div class="drawer-side z-40">
        <label for="sidebar-toggle" class="drawer-overlay"></label>
        <div class="w-64 min-h-full bg-base-200 flex flex-col">
          <!-- Logo -->
          <div class="px-4 py-4 border-b border-base-300">
            <span class="font-bold text-lg">🗄️ Adminer Node</span>
            <div v-if="store.conn" class="text-xs text-base-content/60 mt-1 truncate">
              {{ store.conn.username }}@{{ store.conn.server || store.conn.driver }}
            </div>
          </div>

          <!-- Sidebar navigation -->
          <div class="flex-1 overflow-y-auto">
            <Sidebar :params="params" />
          </div>

          <!-- Logout -->
          <div class="p-3 border-t border-base-300">
            <button class="btn btn-sm btn-ghost w-full text-left" @click="logout">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
