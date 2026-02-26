import { reactive } from 'vue';

let _msgId = 0;

export const store = reactive({
  // Connection state
  authenticated: false,
  conn: null,          // { driver, server, username, db }
  connId: null,        // id of the active saved connection preset (if any)
  csrfToken: '',
  driverConfig: null,  // { jush, types, operators, functions, grouping, editFunctions }
  serverInfo: null,

  // Navigation state
  currentDb: '',
  currentTable: '',

  // Flash messages
  messages: [],        // [{ id, type, text }]

  // Actions
  setAuth(payload) {
    this.authenticated = true;
    this.conn = payload.conn;
    this.connId = payload.connId || null;
    this.csrfToken = payload.csrfToken;
    this.driverConfig = payload.driverConfig;
    this.serverInfo = payload.serverInfo;
    this.currentDb = payload.conn?.db || '';
  },

  clearAuth() {
    this.authenticated = false;
    this.conn = null;
    this.connId = null;
    this.csrfToken = '';
    this.driverConfig = null;
    this.serverInfo = null;
    this.currentDb = '';
    this.currentTable = '';
  },

  setDb(db) {
    this.currentDb = db;
    if (this.conn) this.conn.db = db;
  },

  setTable(table) {
    this.currentTable = table;
  },

  flash(text, type = 'info') {
    const id = ++_msgId;
    this.messages.push({ id, type, text });
    setTimeout(() => this.dismissMessage(id), 5000);
  },

  // Aliases — addMessage is the canonical name used in views
  addMessage(text, type = 'info') { this.flash(text, type); },
  success(text) { this.flash(text, 'success'); },
  error(text)   { this.flash(text, 'error'); },
  info(text)    { this.flash(text, 'info'); },

  dismissMessage(id) {
    const i = this.messages.findIndex(m => m.id === id);
    if (i !== -1) this.messages.splice(i, 1);
  },
});
