import { register } from '../router.js';

async function setupDb(req) {
  const db = req.query?.db || req.connInfo?.db || '';
  if (db && req.conn.support('databases')) await req.conn.selectDb(db);
  return db;
}

function csvRow(values) {
  return values.map(v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(',') + '\r\n';
}

export function registerDumpRoutes() {
  // GET /api/dump — export table(s) as SQL or CSV
  register('GET', '/api/dump', async (req, res) => {
    try {
      const db = await setupDb(req);
      const q = req.query || {};
      const format = q.format || 'sql';
      const tables = q.tables ? q.tables.split(',').map(t => t.trim()) : await req.conn.tablesList(db).then(ts => ts.map(t => t.name));
      const includeData = q.data !== '0';
      const includeStructure = q.structure !== '0';
      const dbName = db || 'dump';
      const filename = `${dbName}_${new Date().toISOString().slice(0, 10)}.${format}`;

      if (format === 'csv') {
        if (tables.length !== 1) return res.error('CSV export requires exactly one table (use ?tables=name)', 400);
        res.stream('text/csv', filename);
        const fields = await req.conn.fields(tables[0]);
        const header = fields.map(f => f.name);
        res.write(csvRow(header));
        let offset = 0;
        const batchSize = 500;
        while (true) {
          const result = await req.conn.select(tables[0], { limit: batchSize, offset });
          if (!result.rows?.length) break;
          for (const row of result.rows) res.write(csvRow(header.map(h => row[h])));
          if (result.rows.length < batchSize) break;
          offset += batchSize;
        }
        res.end();
        return;
      }

      // SQL format
      res.stream('text/plain; charset=utf-8', filename);
      res.write(`-- adminer-node SQL dump — ${new Date().toISOString()}\n`);
      if (db) res.write(`-- Database: ${db}\n\n`);

      for (const table of tables) {
        if (includeStructure) {
          const ddl = await req.conn.createSql(table);
          if (ddl) {
            res.write(`\n-- Table: ${table}\n`);
            res.write(`DROP TABLE IF EXISTS ${req.conn.escapeId(table)};\n`);
            res.write(ddl + ';\n');
          }
        }

        if (includeData) {
          let offset = 0;
          const batchSize = 500;
          const fields = await req.conn.fields(table);
          const colNames = fields.map(f => f.name);
          while (true) {
            const result = await req.conn.select(table, { limit: batchSize, offset });
            if (!result.rows?.length) break;
            for (const row of result.rows) {
              const vals = colNames.map(c => {
                const v = row[c];
                if (v === null || v === undefined) return 'NULL';
                if (typeof v === 'number') return String(v);
                return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
              });
              res.write(`INSERT INTO ${req.conn.escapeId(table)} (${colNames.map(c => req.conn.escapeId(c)).join(', ')}) VALUES (${vals.join(', ')});\n`);
            }
            if (result.rows.length < batchSize) break;
            offset += batchSize;
          }
        }
      }

      res.write('\n-- Dump complete\n');
      res.end();
    } catch (e) {
      if (!res.headersSent) res.error(e.message, 503, { code: 'DB_ERROR' });
      else res.end();
    }
  });
}
