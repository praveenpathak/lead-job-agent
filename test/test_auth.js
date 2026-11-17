import assert from 'node:assert';
import {
  registerUser,
  loginUser,
  verifyToken,
  getUserById,
  getUserProfile,
  saveUserProfile,
  getUserApplications,
  upsertUserApplication,
  deleteUserApplication,
  upsertUserApplicationsBulk
} from '../lib/auth.js';

async function runTests() {
  console.log('Testing Authentication & Per-User Persistence...');

  const testEmail = `test_${Date.now()}@example.com`;
  const testPass = 'pass1234';

  // 1. Register User
  const reg = await registerUser({
    name: 'Praveen Tester',
    email: testEmail,
    phone: '+91 8109567672',
    password: testPass
  });
  assert(reg.user && reg.user.id, 'User registered successfully');
  assert.equal(reg.user.email, testEmail);
  assert(reg.token, 'Token generated on registration');
  console.log('✔ Registration passed');

  // 2. Duplicate registration should throw
  let dupFailed = false;
  try {
    await registerUser({ name: 'Dup', email: testEmail, password: 'xyz' });
  } catch (err) {
    dupFailed = true;
  }
  assert(dupFailed, 'Duplicate email was rejected');
  console.log('✔ Duplicate check passed');

  // 3. Verify Token
  const verifiedId = await verifyToken(reg.token);
  assert.equal(verifiedId, reg.user.id, 'Token verified correctly');
  console.log('✔ Token verification passed');

  // 4. Login User
  const logged = await loginUser({ email: testEmail, password: testPass });
  assert.equal(logged.user.id, reg.user.id, 'Login successful');
  assert(logged.token, 'Login returned valid token');
  console.log('✔ Login passed');

  // 5. Wrong password should throw
  let badPassFailed = false;
  try {
    await loginUser({ email: testEmail, password: 'wrongpassword' });
  } catch {
    badPassFailed = true;
  }
  assert(badPassFailed, 'Invalid password rejected');
  console.log('✔ Invalid password check passed');

  // 6. User Profile check & update
  const prof = await getUserProfile(reg.user.id);
  assert.equal(prof.email, testEmail);
  await saveUserProfile(reg.user.id, { gsheetUrl: 'https://script.google.com/macros/s/test/exec' });
  const updatedProf = await getUserProfile(reg.user.id);
  assert.equal(updatedProf.gsheetUrl, 'https://script.google.com/macros/s/test/exec');
  console.log('✔ User profile update passed');

  // 7. User Applications isolation
  const app1 = {
    kind: 'Lead',
    title: 'Dr. Dental Clinic (WordPress)',
    company: 'contact@dental.com',
    url: 'https://dental.com',
    status: 'Pitched',
    notes: 'Morning pitch test'
  };
  await upsertUserApplication(reg.user.id, app1);
  const apps = await getUserApplications(reg.user.id);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].url, 'https://dental.com');
  assert.equal(apps[0].status, 'Pitched');
  console.log('✔ Upsert application passed');

  // 8. Bulk Upsert
  const app2 = { kind: 'Lead', title: 'Orbit Local (WordPress)', url: 'https://orbitlocal.com', status: 'Pitched' };
  await upsertUserApplicationsBulk(reg.user.id, [app2]);
  const apps2 = await getUserApplications(reg.user.id);
  assert.equal(apps2.length, 2);
  console.log('✔ Bulk upsert passed');

  // 9. Delete Application
  await deleteUserApplication(reg.user.id, 'https://dental.com');
  const apps3 = await getUserApplications(reg.user.id);
  assert.equal(apps3.length, 1);
  assert.equal(apps3[0].url, 'https://orbitlocal.com');
  console.log('✔ Delete application passed');

  console.log('\nAll Auth & Per-User Persistence Tests PASSED successfully! 🚀\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
