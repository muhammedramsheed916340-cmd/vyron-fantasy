const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // 1. Verify all tables exist
  const tables = await p.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  console.log('=== Tables in Neon PostgreSQL ===');
  tables.forEach(r => console.log('  ✓', r.tablename));

  // 2. Check _prisma_migrations exists
  const migrations = await p.$queryRaw`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at`;
  console.log('\n=== Prisma Migrations ===');
  migrations.forEach(m => console.log('  ✓', m.migration_name, '→ applied'));

  // 3. AdminSession.create — THE FAILING OPERATION
  const session = await p.adminSession.create({
    data: {
      token: 'vercel-admin-login-' + crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
  });
  console.log('\n=== Admin Login Flow ===');
  console.log('✓ AdminSession.create() →', session.id);

  // 4. findUnique by token (verifyAdminAuth uses this)
  const found = await p.adminSession.findUnique({ where: { token: session.token } });
  console.log('✓ AdminSession.findUnique(token) → FOUND');

  // 5. Not expired
  console.log('✓ Session valid →', new Date(found.expiresAt) > new Date());

  // 6. Cleanup
  await p.adminSession.delete({ where: { id: session.id } });
  console.log('✓ AdminSession.delete() → SUCCESS');

  console.log('\n=== ADMIN LOGIN WILL WORK ON VERCEL ===');
  await p.$disconnect();
})();
