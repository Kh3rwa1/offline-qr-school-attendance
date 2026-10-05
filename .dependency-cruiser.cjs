/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'services-no-express',
      severity: 'error',
      from: { path: '^src/services' },
      to: { path: 'node_modules/express' },
      comment: 'Services are framework-free; take typed inputs, return typed outputs.',
    },
    {
      name: 'db-no-upward',
      severity: 'error',
      from: { path: '^src/db' },
      to: { path: '^src/(routes|services|middleware|http)' },
      comment: 'Database layer must not depend on routes, services, middleware, or http.',
    },
    {
      name: 'frontend-no-server',
      severity: 'error',
      from: { path: '^src/(app|components|dashboards|hooks)' },
      to: { path: '^src/(db|services/rfid|middleware|routes)' },
      comment: 'Browser bundle must never import server code (secrets, pg).',
    },
    {
      name: 'no-pglite-in-prod-path',
      severity: 'error',
      from: { path: '^src', pathNot: '^src/db/testDriver\\.ts$' },
      to: { path: '@electric-sql/pglite' },
      comment: 'Only testDriver may import @electric-sql/pglite.',
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
