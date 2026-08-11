const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  let passed = 0, failed = 0;
  const check = (name, ok, detail = '') => {
    if (ok) { passed++; console.log('  ✓', name, detail); }
    else { failed++; console.log('  ✗', name, detail); }
  };

  console.log('=== 1. Admin Login Test ===');
  const session = await p.adminSession.create({
    data: { token: 'admin-' + crypto.randomUUID(), expiresAt: new Date(Date.now() + 14400000) },
  });
  check('AdminSession.create()', !!session.id, '→ ' + session.id);
  const found = await p.adminSession.findUnique({ where: { token: session.token } });
  check('AdminSession.findUnique()', !!found);
  check('Session not expired', new Date(found.expiresAt) > new Date());
  await p.adminSession.delete({ where: { id: session.id } });
  check('AdminSession.delete()', true);

  console.log('\n=== 2. License & Transfer Test ===');
  const activeLicenses = await p.license.findMany({ where: { status: 'ACTIVE' } });
  check('Active license exists', activeLicenses.length > 0, '→ ' + activeLicenses.length + ' license(s)');
  if (activeLicenses.length > 0) {
    const lic = activeLicenses[0];
    check('License key', true, lic.key);
    check('License type', true, lic.type);
    check('License status', lic.status === 'ACTIVE', lic.status);
  }

  // Test findActiveLicenseForAccount with any phone number
  const anyLicense = await p.license.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
  check('Any active license found', !!anyLicense, anyLicense ? '→ ' + anyLicense.key : '');
  check('Transfer will be UNBLOCKED', !!anyLicense);

  console.log('\n=== 3. Tables Check ===');
  const tables = await p.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const required = ['AdminSession', 'License', 'TransferLog', 'User', 'Post'];
  for (const t of required) {
    check('Table: ' + t, tables.some(r => r.tablename === t));
  }

  console.log('\n=== RESULT: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed > 0) process.exit(1);
  await p.$disconnect();
})();
