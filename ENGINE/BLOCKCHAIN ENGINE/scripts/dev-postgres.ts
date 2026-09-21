/**
 * Dev helper: runs a user-space PostgreSQL (no admin rights, no service)
 * for local indexer runs. Data lives in .pgdata/ (git-ignored).
 *
 *   node scripts/dev-postgres.ts start [port]
 *   node scripts/dev-postgres.ts stop
 *
 * Default port 5433 to avoid clashing with any system install.
 * Connection string: postgres://anchors:anchors@127.0.0.1:5433/anchors
 */
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

// ESM-only package: pull the default export out of the module namespace.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const EmbeddedPostgres = (require('embedded-postgres') as { default: new (opts: Record<string, unknown>) => {
  initialise: () => Promise<void>;
  start: () => Promise<void>;
  close: (sig?: string) => Promise<void>;
}; }).default;

const PID_FILE = join('.pgdata', 'pid.json');
const DEFAULT_PORT = 5433;
const CONNECTION = {
  user: 'anchors',
  password: 'anchors',
  database: 'anchors',
  port: DEFAULT_PORT,
};

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'start';
  const port = Number(process.argv[3] ?? DEFAULT_PORT);

  if (cmd === 'start') {
    if (existsSync(PID_FILE)) {
      console.log('PostgreSQL appears to be running (pid file exists). Use `stop` first.');
      return;
    }
    const pg = new EmbeddedPostgres({
      databaseDir: '.pgdata',
      user: CONNECTION.user,
      password: CONNECTION.password,
      persistence: true,
      port,
    });

    if (!existsSync(join('.pgdata', 'PG_VERSION'))) {
      console.log('Initialising cluster ...');
      await pg.initialise();
    }
    await pg.start();
    writeFileSync(PID_FILE, JSON.stringify({ port, pid: process.pid }));
    console.log(`PostgreSQL ready: postgres://anchors:anchors@127.0.0.1:${port}/anchors`);
    console.log('Stop with: node scripts/dev-postgres.ts stop');

    // Keep running until stopped (foreground dev process).
    const shutdown = async () => {
      try {
        await pg.close('SIGINT');
      } finally {
        if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
        process.exit(0);
      }
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    setInterval(() => undefined, 60_000); // hold the event loop
    return;
  }

  if (cmd === 'stop') {
    if (!existsSync(PID_FILE)) {
      console.log('Not running (no pid file).');
      return;
    }
    // Killing the foreground `start` process triggers its SIGINT shutdown.
    const { pid } = JSON.parse(readFileSync(PID_FILE, 'utf8')) as { pid?: number };
    if (pid) process.kill(pid);
    console.log('Stop requested.');
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
