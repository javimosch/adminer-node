import { createApp, ref, computed, watch, provide, onMounted } from 'vue';
import { store } from './store.js';
import { api } from './api.js';
import { addRoute, parseHash, matchRoute, navigate } from './router.js';

// Components
import AppLayout from './components/AppLayout.js';
import FlashMessage from './components/FlashMessage.js';

// Views
import LoginView from './views/LoginView.js';
import HomeView from './views/HomeView.js';
import DatabaseView from './views/DatabaseView.js';
import TableListView from './views/TableListView.js';
import TableStructureView from './views/TableStructureView.js';
import SelectView from './views/SelectView.js';
import EditView from './views/EditView.js';
import SqlView from './views/SqlView.js';
import DumpView from './views/DumpView.js';
import UsersView from './views/UsersView.js';
import VariablesView from './views/VariablesView.js';
import CreateTableView from './views/CreateTableView.js';
import ServerInfoView from './views/ServerInfoView.js';

// Register routes
addRoute('/',                               HomeView);   // root → home (saved connections)
addRoute('/login',                          LoginView);
addRoute('/home',                           HomeView);
addRoute('/databases',                      ServerInfoView);
addRoute('/db',                             DatabaseView);        // create db
addRoute('/db/:db',                         TableListView);       // list tables
addRoute('/db/:db/tables',                  TableListView);
addRoute('/db/:db/table/:table',            TableStructureView);
addRoute('/db/:db/table/:table/create',     CreateTableView);
addRoute('/db/:db/table/new',               CreateTableView);
addRoute('/db/:db/table/:table/select',     SelectView);
addRoute('/db/:db/table/:table/edit',       EditView);
addRoute('/db/:db/table/:table/insert',     EditView);
addRoute('/db/:db/sql',                     SqlView);
addRoute('/db/:db/dump',                    DumpView);
addRoute('/users',                          UsersView);
addRoute('/variables',                      VariablesView);

const App = {
  name: 'App',
  components: { AppLayout, FlashMessage },
  setup() {
    const currentRoute = ref(null);
    const routeParams = ref({});
    const loading = ref(true);

    function resolveRoute() {
      const path = parseHash();
      const match = matchRoute(path);
      if (match) {
        currentRoute.value = match.component;
        routeParams.value = match.params;
      } else {
        // Unmatched route — go home (which shows connections or login button)
        navigate('/');
      }
    }

    // Watch hash changes
    window.addEventListener('hashchange', resolveRoute);

    onMounted(async () => {
      // Check existing session
      const { data } = await api.status();
      if (data?.authenticated && data.conn) {
        // Restore session — re-login to get csrfToken and driverConfig
        store.setAuth({
          conn: data.conn,
          csrfToken: '',   // will be refreshed on next login; use empty for now
          driverConfig: null,
          serverInfo: null,
        });
        store.authenticated = true;
      }
      loading.value = false;
      resolveRoute();
    });

    const showLayout = computed(() => {
      const route = currentRoute.value;
      const routeName = route?.name;
      const noLayout = routeName === 'HomeView' || routeName === 'LoginView';
      const result = store.authenticated && !!route && !noLayout;
      return result;
    });

    return { currentRoute, routeParams, loading, showLayout };
  },
  template: `
    <div class="min-h-screen">
      <FlashMessage />
      <div v-if="loading" class="flex items-center justify-center min-h-screen">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
      <template v-else-if="currentRoute">
        <AppLayout v-if="showLayout" :params="routeParams">
          <component :is="currentRoute" :params="routeParams" />
        </AppLayout>
        <component v-else :is="currentRoute" :params="routeParams" />
      </template>
    </div>
  `,
};

const app = createApp(App);
app.provide('store', store);
app.provide('navigate', navigate);
app.provide('api', api);
app.mount('#app');
