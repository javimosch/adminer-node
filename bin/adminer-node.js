#!/usr/bin/env node
import { startServer } from '../src/server.js';
import { buildConfig } from '../src/config.js';

const args = process.argv.slice(2);

function parseArgs(argv) {
  const opts = {};
  let configPath = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(`
adminer-node — Database management UI

Usage:
  npx adminer-node [options]

Options:
  --port <port>      HTTP port to listen on (default: 8080)
  --host <host>      Host to bind to (default: 127.0.0.1)
  --no-open          Do not open browser automatically
  --driver <driver>  Pre-select driver: mysql | pgsql | sqlite
  --config <path>    Path to config JSON file (default: ~/.config/adminer-node/config.json)
  --help             Show this help message

Config file format (~/.config/adminer-node/config.json):
  {
    "port": 8080,
    "basicAuth": { "username": "admin", "password": "secret" },
    "connections": [
      { "label": "Local MySQL", "driver": "mysql", "server": "127.0.0.1", "username": "root", "password": "secret", "db": "mydb" },
      { "label": "Dev SQLite",  "driver": "sqlite", "server": "/tmp/dev.db", "username": "", "password": "" }
    ]
  }

Environment variables:
  PORT / ADMINER_PORT          HTTP port
  HOST / ADMINER_HOST          Bind host
  ADMINER_DRIVER               Default driver
  ADMINER_NO_OPEN=1            Disable auto browser open
  ADMINER_CONFIG               Path to config JSON file
  ADMINER_CONNECTIONS          JSON array of connection presets
  ADMINER_BASIC_USER           HTTP Basic Auth username
  ADMINER_BASIC_PASS           HTTP Basic Auth password
`);
      process.exit(0);
    } else if (arg === '--no-open') {
      opts.openBrowser = false;
    } else if (arg === '--port' && argv[i + 1]) {
      opts.port = parseInt(argv[++i], 10);
    } else if (arg === '--host' && argv[i + 1]) {
      opts.host = argv[++i];
    } else if (arg === '--driver' && argv[i + 1]) {
      opts.driver = argv[++i];
    } else if (arg === '--config' && argv[i + 1]) {
      configPath = argv[++i];
    }
  }
  return { opts, configPath };
}

async function main() {
  const { opts: cliOpts, configPath } = parseArgs(args);
  const config = buildConfig(cliOpts, configPath);

  const server = await startServer(config);
  const addr = `http://${config.host}:${config.port}`;

  console.log(`\nAdminer Node v${config.version}`);
  console.log(`Listening on ${addr}`);
  if (config.configFile) {
    console.log(`Config: ${config.configFile}`);
  }
  if (config.basicAuth) {
    console.log(`Basic Auth: enabled (user: ${config.basicAuth.username})`);
  }
  if (config.connections.length) {
    console.log(`\nSaved connections (${config.connections.length}):`);
    config.connections.forEach((c, i) => {
      console.log(`  [${i}] ${c.label || c.driver} — ${c.driver}://${c.server}${c.db ? '/' + c.db : ''}`);
    });
  }
  console.log('\nPress Ctrl+C to stop.\n');

  if (config.openBrowser) {
    try {
      const { default: open } = await import('open');
      await open(addr);
    } catch {
      // open is optional — ignore if unavailable
    }
  }

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
