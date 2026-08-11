/**
 * End-to-end migration test for SQLite → Neon PostgreSQL
 * Tests all admin operations against the real Neon database
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  const results = [];
  let passed = 0;
  let failed = 0;

  function check(name, condition, detail = '') {
    if (condition) {
      passed++;
      results.push(`  ✓ ${name} ${detail}`);
    } else {
      failed++;
      results.push(`  ✗ ${name} ${detail}`);
    }
  }

  try {
    console.log('=== SQLite → Neon PostgreSQL Migration Test ===\n');

    // Test 1: AdminSession.create (the exact failing operation)
    console.log('Test 1: AdminSession.create()');
    const session = await prisma.adminSession.create({
      data: {
        token: 'test-' + crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
    });
    check('AdminSession.create', !!session.id, `→ id: ${session.id}`);
    check('AdminSession token stored', !!session.token, `→ token: ${session.token.substring(0, 12)}...`);
    check('AdminSession expiresAt stored', !!session.expiresAt);

    // Test 2: AdminSession.findUnique (used by verifyAdminAuth)
    console.log('Test 2: AdminSession.findUnique()');
    const found = await prisma.adminSession.findUnique({ where: { token: session.token } });
    check('AdminSession.findUnique by token', !!found);
    check('Token matches', found?.token === session.token);

    // Test 3: AdminSession.delete (used for expired session cleanup)
    console.log('Test 3: AdminSession.delete()');
    await prisma.adminSession.delete({ where: { id: session.id } });
    const deleted = await prisma.adminSession.findUnique({ where: { token: session.token } });
    check('AdminSession.delete works', deleted === null);

    // Test 4: License.create (admin panel operation)
    console.log('Test 4: License.create()');
    const license = await prisma.license.create({
      data: {
        key: 'VYRON-TEST-MIGR-ATION',
        type: 'MONTHLY',
        status: 'INACTIVE',
        notes: 'Migration test',
      },
    });
    check('License.create', !!license.id, `→ key: ${license.key}`);

    // Test 5: License.findUnique (used in license validate)
    console.log('Test 5: License.findUnique()');
    const foundLicense = await prisma.license.findUnique({ where: { key: license.key } });
    check('License.findUnique by key', !!foundLicense);

    // Test 6: License.update (activate license)
    console.log('Test 6: License.update()');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const activated = await prisma.license.update({
      where: { id: license.id },
      data: { status: 'ACTIVE', activatedAt: now, expiresAt, assignedTo: 'test-user' },
    });
    check('License.update (activate)', activated.status === 'ACTIVE');
    check('License assignedTo stored', activated.assignedTo === 'test-user');

    // Test 7: License.findMany (admin list licenses)
    console.log('Test 7: License.findMany()');
    const licenses = await prisma.license.findMany({ where: {}, orderBy: { createdAt: 'desc' } });
    check('License.findMany returns array', Array.isArray(licenses));
    check('License.findMany includes test license', licenses.some(l => l.key === license.key));

    // Test 8: TransferLog.create + findMany
    console.log('Test 8: TransferLog operations');
    const log = await prisma.transferLog.create({
      data: {
        licenseKey: license.key,
        platform: 'dream11',
        matchId: 'test-match-001',
        transferType: 'new',
        teamCount: 5,
        successCount: 4,
        failCount: 1,
      },
    });
    check('TransferLog.create', !!log.id);
    const logs = await prisma.transferLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    check('TransferLog.findMany', Array.isArray(logs));

    // Test 9: License with contains filter (PostgreSQL case-insensitive by default)
    console.log('Test 9: License search with contains');
    const searchResult = await prisma.license.findMany({
      where: { key: { contains: 'VYRON' } },
    });
    check('License search with contains', searchResult.length > 0);

    // Test 10: License.delete (cleanup)
    console.log('Test 10: License.delete()');
    await prisma.license.delete({ where: { id: license.id } });
    await prisma.transferLog.delete({ where: { id: log.id } });
    check('License deleted successfully', true);
    check('TransferLog deleted successfully', true);

    // Summary
    console.log('\n' + results.join('\n'));
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
