import { store } from './store.js';

/**
 * Base fetch wrapper. Adds CSRF token header and handles JSON parsing.
 * Returns { data, error } — never throws.
 */
async function request(method, path, body = null, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (store.csrfToken) headers['X-CSRF-Token'] = store.csrfToken;

  const fetchOpts = { method, headers, credentials: 'same-origin' };
  if (body !== null && !['GET', 'HEAD'].includes(method)) {
    fetchOpts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(path, fetchOpts);
    const ct = res.headers.get('content-type') || '';
    let data = null;
    if (ct.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    if (!res.ok) {
      return { data: null, error: (data?.error || data || `HTTP ${res.status}`) };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

/** Build query string from an object, including nested objects for where clauses. */
function buildQs(params) {
  if (!params) return '';
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      for (const [sk, sv] of Object.entries(v)) {
        if (sv === null || sv === undefined) continue;
        if (typeof sv === 'object') {
          for (const [ssk, ssv] of Object.entries(sv)) {
            if (ssv !== null && ssv !== undefined) parts.push(`${encodeURIComponent(`${k}[${sk}][${ssk}]`)}=${encodeURIComponent(ssv)}`);
          }
        } else {
          parts.push(`${encodeURIComponent(`${k}[${sk}]`)}=${encodeURIComponent(sv)}`);
        }
      }
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

export const api = {
  // Auth
  login: (body)    => request('POST', '/api/auth/login', body),
  logout: ()       => request('POST', '/api/auth/logout'),
  status: ()       => request('GET', '/api/status'),
  drivers: ()      => request('GET', '/api/drivers'),

  // Databases
  databases: ()            => request('GET', '/api/databases'),
  createDatabase: (body)   => request('POST', '/api/databases', body),
  dropDatabase: (db)       => request('DELETE', `/api/databases/${encodeURIComponent(db)}`),

  // Tables
  tables: (db)             => request('GET', `/api/tables${buildQs({ db })}`),
  tableStructure: (name, db) => request('GET', `/api/table/${encodeURIComponent(name)}${buildQs({ db })}`),
  createTable: (body, db)  => request('POST', `/api/table${buildQs({ db })}`, body),
  dropTable: (name, db)    => request('DELETE', `/api/table/${encodeURIComponent(name)}${buildQs({ db })}`),
  truncateTable: (name, db) => request('POST', `/api/table/${encodeURIComponent(name)}/truncate${buildQs({ db })}`),
  tableSql: (name, db)     => request('GET', `/api/table/${encodeURIComponent(name)}/sql${buildQs({ db })}`),

  // Select / browse
  select: (table, params)  => request('GET', `/api/select/${encodeURIComponent(table)}${buildQs(params)}`),
  bulkDelete: (table, body) => request('POST', `/api/select/${encodeURIComponent(table)}`, body),

  // Edit (row CRUD)
  getRow: (table, params)  => request('GET', `/api/edit/${encodeURIComponent(table)}${buildQs(params)}`),
  insertRow: (table, body) => request('POST', `/api/edit/${encodeURIComponent(table)}`, body),
  updateRow: (table, body) => request('PUT', `/api/edit/${encodeURIComponent(table)}`, body),
  deleteRow: (table, body) => request('DELETE', `/api/edit/${encodeURIComponent(table)}`, body),

  // SQL command
  sql: (body)              => request('POST', '/api/sql', body),
  explain: (body)          => request('POST', '/api/sql/explain', body),

  // Dump/export URL (for download link)
  dumpUrl: (params)        => `/api/dump${buildQs(params)}`,

  // Indexes
  indexes: (table, db)     => request('GET', `/api/indexes/${encodeURIComponent(table)}${buildQs({ db })}`),
  alterIndexes: (table, body) => request('POST', `/api/indexes/${encodeURIComponent(table)}`, body),

  // Foreign keys
  foreignKeys: (table, db) => request('GET', `/api/foreign/${encodeURIComponent(table)}${buildQs({ db })}`),
  alterForeign: (table, body) => request('POST', `/api/foreign/${encodeURIComponent(table)}`, body),

  // Users
  users: ()                => request('GET', '/api/users'),

  // Variables / processlist
  variables: ()            => request('GET', '/api/variables'),
  processList: ()          => request('GET', '/api/processlist'),
  killProcess: (id)        => request('DELETE', `/api/processlist/${encodeURIComponent(id)}`),
};
