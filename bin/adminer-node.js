#!/usr/bin/env node
import { startServer } from '../src/server.js';
import { buildConfig } from '../src/config.js';

const args = process.argv.slice(2);

function parseArgs(argv) {
  const opts = {};
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
  --help             Show this help message
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
    }
  }
  return opts;
}

async function main() {
  const cliOpts = parseArgs(args);
  const config = buildConfig(cliOpts);

  const server = await startServer(config);
  const addr = `http://${config.host}:${config.port}`;

  console.log(`\nAdminer Node v${config.version}`);
  console.log(`Listening on ${addr}`);
  console.log('Press Ctrl+C to stop.\n');

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
