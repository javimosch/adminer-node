export function formatSize(bytes) {
  if (bytes == null) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

export function formatNumber(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

export function formatDuration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function truncate(str, len = 100) {
  if (str == null) return '';
  const s = String(str);
  if (s.length <= len) return s;
  return s.slice(0, len) + '…';
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isNullValue(v) {
  return v === null || v === undefined;
}

export function buildQueryString(obj) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== '') {
      params.set(k, String(v));
    }
  }
  return params.toString();
}

export function parseQueryString(str) {
  const params = new URLSearchParams(str.startsWith('?') ? str.slice(1) : str);
  const obj = {};
  for (const [k, v] of params) obj[k] = v;
  return obj;
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  }
}

export function downloadBlob(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function sqlHighlight(code) {
  if (typeof hljs === 'undefined') return escapeHtml(code);
  try {
    return hljs.highlight(code, { language: 'sql' }).value;
  } catch {
    return escapeHtml(code);
  }
}

export function formatCellValue(value, field) {
  if (isNullValue(value)) return { type: 'null', display: 'NULL' };
  if (typeof value === 'object' && value !== null) {
    return { type: 'json', display: JSON.stringify(value) };
  }
  const str = String(value);
  if (str.length > 200) return { type: 'long', display: str.slice(0, 200) + '…', full: str };
  return { type: 'text', display: str };
}
