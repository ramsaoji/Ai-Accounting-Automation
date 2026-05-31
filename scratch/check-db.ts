import { getSecurityCredentials, verifyPasscode } from '../src/api/controllers/security.controller.js';
import { db, initDb } from '../src/db/db.client.js';

async function test() {
  await initDb();
  if (db) {
    const creds = await getSecurityCredentials();
    console.log('Creds from DB:', creds);
    
    if (creds.uploadPassword) {
      const match = await verifyPasscode(creds.uploadPassword, 'admin1234');
      console.log('Match with admin1234:', match);
    } else {
      console.log('uploadPassword is undefined!');
    }
  } else {
    console.log('DB not ready');
  }
}

test().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
