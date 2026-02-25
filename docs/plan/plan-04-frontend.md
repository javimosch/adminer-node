# adminer-node — Frontend Architecture

## Philosophy

- **No build step**: Vue 3 loaded as an ES module from CDN. Components are plain `.js` files exporting Vue component option objects or `defineComponent()` calls.
- **No `.vue` SFCs**: Since there's no bundler, components are defined in `.js` files using `template` strings or `h()` render functions.
- **CDN dependencies**: Tailwind CSS + DaisyUI + highlight.js — all from CDN, pinned to known versions in the HTML shell.
- **Progressive**: Works in any modern browser (Chrome, Firefox, Safari, Edge). No IE support required.

---

## CDN Links (pinned in `pages/shell.js`)

```html
<!-- Tailwind CSS (play CDN with DaisyUI plugin) -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    plugins: [],  // DaisyUI loaded separately as CSS
    theme: { extend: {} }
  }
</script>

<!-- DaisyUI CSS -->
<link href="https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css" rel="stylesheet">

<!-- Vue 3 ES Module (loaded via importmap) -->
<script type="importmap">
{
  "imports": {
    "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js"
  }
}
</script>

<!-- highlight.js for SQL display -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/sql.min.js"></script>
```

---

## File Structure (`public/app/`)

```
public/app/
├── main.js               # createApp, mount, global error handler     (≤ 80 LOC)
├── router.js             # client-side hash router                    (≤ 120 LOC)
├── store.js              # reactive global state (ref/reactive)       (≤ 120 LOC)
├── api.js                # fetch wrapper, CSRF header injection       (≤ 100 LOC)
├── utils.js              # shared helpers (format, escape, etc.)      (≤ 100 LOC)
├── components/
│   ├── AppLayout.js      # sidebar + topbar + content slot            (≤ 150 LOC)
│   ├── Sidebar.js        # db list + table list nav                   (≤ 200 LOC)
│   ├── Breadcrumb.js     # breadcrumb bar                             (≤ 60 LOC)
│   ├── DataTable.js      # sortable, paginated table display          (≤ 300 LOC)
│   ├── SqlEditor.js      # textarea + highlight.js integration        (≤ 120 LOC)
│   ├── FieldInput.js     # smart field input (enum/date/etc.)         (≤ 250 LOC)
│   ├── FieldEditor.js    # column definition row (for CREATE/ALTER)   (≤ 300 LOC)
│   ├── Modal.js          # confirm/alert dialog                       (≤ 80 LOC)
│   ├── FlashMessage.js   # toast notifications                        (≤ 80 LOC)
│   └── Pagination.js     # page number bar                            (≤ 80 LOC)
└── views/
    ├── LoginView.js           # login form + driver/server select     (≤ 200 LOC)
    ├── HomeView.js            # server overview, DB list              (≤ 200 LOC)
    ├── DatabaseView.js        # create/drop/alter DB                  (≤ 150 LOC)
    ├── TableListView.js       # tables in current DB                  (≤ 200 LOC)
    ├── TableStructureView.js  # fields + indexes + FKs               (≤ 300 LOC)
    ├── CreateTableView.js     # DDL builder form                      (≤ 400 LOC)
    ├── SelectView.js          # browse rows (filter/sort/paginate)    (≤ 450 LOC)
    ├── EditView.js            # insert / edit single row              (≤ 300 LOC)
    ├── SqlView.js             # SQL command + history                 (≤ 350 LOC)
    ├── DumpView.js            # export options form                   (≤ 250 LOC)
    ├── IndexesView.js         # manage indexes                        (≤ 250 LOC)
    ├── ForeignView.js         # manage foreign keys                   (≤ 250 LOC)
    ├── UsersView.js           # user/privilege management             (≤ 300 LOC)
    └── VariablesView.js       # server variables + processlist        (≤ 200 LOC)
```

---

## `main.js` — App Bootstrap

```js
import { createApp } from 'vue';
import { router } from './router.js';
import { store } from './store.js';
import AppLayout from './components/AppLayout.js';

const app = createApp(AppLayout);
app.use(router);

// Make store available as $store in all components
app.provide('store', store);

// Global error handler
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue error:', err, info);
  store.flashError('An unexpected error occurred.');
};

// Read CSRF token injected into HTML meta tag
store.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ?? '';

app.mount('#app');
```

---

## `router.js` — Hash-Based Client Router

Uses Vue Router 4 loaded from CDN (added to importmap). Hash mode avoids server-side routing requirements.

```js
import { createRouter, createWebHashHistory } from 'vue-router';
// Routes:
const routes = [
  { path: '/',                    component: () => import('./views/LoginView.js') },
  { path: '/home',                component: () => import('./views/HomeView.js') },
  { path: '/db',                  component: () => import('./views/DatabaseView.js') },
  { path: '/tables',              component: () => import('./views/TableListView.js') },
  { path: '/table/:name',         component: () => import('./views/TableStructureView.js') },
  { path: '/create-table',        component: () => import('./views/CreateTableView.js') },
  { path: '/select/:table',       component: () => import('./views/SelectView.js') },
  { path: '/edit/:table',         component: () => import('./views/EditView.js') },
  { path: '/sql',                 component: () => import('./views/SqlView.js') },
  { path: '/dump',                component: () => import('./views/DumpView.js') },
  { path: '/indexes/:table',      component: () => import('./views/IndexesView.js') },
  { path: '/foreign/:table',      component: () => import('./views/ForeignView.js') },
  { path: '/users',               component: () => import('./views/UsersView.js') },
  { path: '/variables',           component: () => import('./views/VariablesView.js') },
];
```

Navigation guard: redirect to `/` (login) if `store.conn` is null and route requires auth.

---

## `store.js` — Global Reactive State

```js
import { reactive, ref } from 'vue';

export const store = reactive({
  // Auth state
  conn: null,          // { driver, server, username, db, csrfToken }
  csrfToken: '',

  // Navigation state
  currentDb: '',
  currentTable: '',
  tableList: [],       // cached for sidebar
  dbList: [],          // cached for sidebar

  // Flash messages
  messages: [],        // [{ type: 'success'|'error'|'info', text, id }]
  flashSuccess(text) { ... },
  flashError(text) { ... },
  dismissMessage(id) { ... },

  // Driver config (types, operators, functions — from /api/status)
  driverConfig: null,
});
```

No Vuex/Pinia — `reactive()` is sufficient for this scale. The store is injected via `provide/inject`.

---

## `api.js` — Fetch Wrapper

```js
import { store } from './store.js';

async function apiFetch(method, path, body = null, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': store.csrfToken,
    ...opts.headers,
  };
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: opts.signal,
  });
  if (res.status === 401) {
    store.conn = null;
    router.push('/');
    return;
  }
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error, res.status, data);
  return data;
}

export const api = {
  get: (path, query) => apiFetch('GET', withQuery(path, query)),
  post: (path, body) => apiFetch('POST', path, body),
  put: (path, body) => apiFetch('PUT', path, body),
  delete: (path, body) => apiFetch('DELETE', path, body),
  // For file downloads (dump):
  download(path, query) { window.location = `/api${withQuery(path, query)}`; },
};
```

---

## Component Design Patterns

### Component File Shape

Since there are no `.vue` SFCs, each component is a `.js` file:

```js
// components/Modal.js
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'Modal',
  props: {
    title: String,
    confirmLabel: { type: String, default: 'Confirm' },
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit, slots }) {
    // logic
  },
  template: `
    <dialog class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">{{ title }}</h3>
        <slot />
        <div class="modal-action">
          <button class="btn btn-primary" @click="$emit('confirm')">{{ confirmLabel }}</button>
          <button class="btn" @click="$emit('cancel')">Cancel</button>
        </div>
      </div>
    </dialog>
  `
});
```

Templates are inline strings — valid because Vue 3's runtime compiler is included in the `esm-browser` build.

---

## Key Components

### `AppLayout.js`
```
┌─────────────────────────────────────────────────────┐
│ navbar: [logo] [server:db breadcrumb] [logout btn]  │
├────────────┬────────────────────────────────────────┤
│  Sidebar   │  <router-view />                       │
│  ─────     │                                        │
│  Databases │  (page content rendered here)          │
│  Tables    │                                        │
│  ─────     │                                        │
│  SQL       │                                        │
│  Export    │                                        │
│  Users     │                                        │
└────────────┴────────────────────────────────────────┘
```

DaisyUI classes: `drawer`, `drawer-side`, `navbar`, `menu`, `menu-compact`.

### `DataTable.js`
- Props: `rows`, `fields`, `selectable` (checkbox column), `sortable`, `loading`
- Emits: `sort(col, dir)`, `select(rowIds)`, `rowClick(row)`
- Features: sticky header, alternating row color, null value display as `<em>NULL</em>`, blob truncation with "download" link, long text truncation with tooltip

DaisyUI classes: `table`, `table-zebra`, `table-pin-rows`, `checkbox`.

### `FieldInput.js`
Renders the appropriate input widget for a given field type:

| Type | Widget |
|---|---|
| `enum`/`set` | `<select>` or multi-select |
| `text`/`blob` | `<textarea>` |
| `date` | `<input type="date">` |
| `datetime`/`timestamp` | `<input type="datetime-local">` |
| `time` | `<input type="time">` |
| `int`/`float` | `<input type="number">` |
| `bool`/`tinyint(1)` | `<input type="checkbox">` |
| everything else | `<input type="text">` |

Also renders a "function" `<select>` alongside the input (NOW(), NULL, UUID, etc.) matching the driver's `editFunctions` config.

### `SqlEditor.js`
- Wraps a `<textarea>` with highlight.js live preview in a `<pre><code>` overlay
- Ctrl+Enter to submit
- Tab key inserts spaces (4) instead of losing focus
- History dropdown (last 20 queries from store)

### `FieldEditor.js`
Used in `CreateTableView` and `TableStructureView` for adding/editing columns:
- Name input, type select (grouped by category from `driverConfig.types`)
- Conditional extras: length/precision, collation (strings), unsigned (integers), ON UPDATE (timestamps), nullable checkbox, default value input, comment input
- Add / Remove / Move Up / Move Down row actions

---

## DaisyUI Theme

Default theme: `light`. Toggle to `dark` via `<html data-theme="dark">`. A sun/moon toggle in the navbar writes preference to `localStorage`.

Key DaisyUI components used:

| UI Need | DaisyUI Component |
|---|---|
| Layout | `drawer`, `navbar`, `hero` |
| Navigation | `menu`, `breadcrumbs`, `tabs` |
| Tables | `table`, `table-zebra` |
| Forms | `input`, `select`, `textarea`, `checkbox`, `radio`, `toggle` |
| Buttons | `btn`, `btn-primary`, `btn-error`, `btn-ghost` |
| Feedback | `alert`, `toast`, `badge`, `loading` |
| Dialogs | `modal` |
| Dropdowns | `dropdown` |
| Cards | `card` |
| Collapse | `collapse` (for filter sections) |

---

## `utils.js` — Shared Helpers

```js
export function formatSize(bytes) { ... }          // "1.2 MB"
export function formatNumber(n) { ... }            // "1,234,567"
export function formatDuration(ms) { ... }         // "12ms" / "1.2s"
export function truncate(str, len=100) { ... }     // with ellipsis
export function escapeHtml(str) { ... }
export function isNullValue(v) { return v === null || v === undefined; }
export function buildQueryString(obj) { ... }      // { a:1, b:2 } → "a=1&b=2"
export function parseQueryString(str) { ... }
export function debounce(fn, ms) { ... }
export function copyToClipboard(text) { ... }      // navigator.clipboard API
export function downloadBlob(blob, filename) { ... }
export function sqlHighlight(code) {               // wrap highlight.js call
  return hljs.highlight(code, { language: 'sql' }).value;
}
```

---

## Routing & URL Scheme

All routing is client-side hash (`#`). Query parameters pass context:

| Route | URL Example |
|---|---|
| Login | `/#/` |
| Home (server overview) | `/#/home` |
| Table list | `/#/tables?db=mydb` |
| Table structure | `/#/table/users?db=mydb` |
| Browse rows | `/#/select/users?db=mydb&page=2&where[id]=5` |
| Edit row | `/#/edit/users?db=mydb&id=5` |
| New row | `/#/edit/users?db=mydb` |
| SQL command | `/#/sql?db=mydb` |
| Export | `/#/dump?db=mydb` |
| Indexes | `/#/indexes/users?db=mydb` |
| Foreign keys | `/#/foreign/users?db=mydb` |
| Create table | `/#/create-table?db=mydb` |
| Users | `/#/users` |
| Variables | `/#/variables` |
