import 'dotenv/config';
import { Client, Databases, Permission, Role } from 'node-appwrite';
import { DB_ID, COLLECTIONS } from '../src/lib/appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

type AttributeConfig = {
  key: string;
  type: string;
  size?: number;
  required?: boolean;
  default?: unknown;
};

const waitForAttributes = () => new Promise((resolve) => setTimeout(resolve, 3000));

async function ensureAttribute(collectionId: string, attr: AttributeConfig) {
  try {
    await databases.getAttribute(DB_ID, collectionId, attr.key);
    console.log(`  ✓ Attribute exists: ${attr.key}`);
    return;
  } catch {
    // create below
  }

  try {
    if (attr.type === 'string') {
      await databases.createStringAttribute(
        DB_ID,
        collectionId,
        attr.key,
        attr.size || 255,
        attr.required ?? false,
        attr.default as string | undefined
      );
    } else if (attr.type === 'integer') {
      await databases.createIntegerAttribute(
        DB_ID,
        collectionId,
        attr.key,
        attr.required ?? false,
        undefined,
        undefined,
        attr.default as number | undefined
      );
    } else if (attr.type === 'boolean') {
      await databases.createBooleanAttribute(
        DB_ID,
        collectionId,
        attr.key,
        attr.required ?? false,
        attr.default as boolean | undefined
      );
    }
    console.log(`  + Attribute: ${attr.key}`);
  } catch {
    console.log(`  ~ Attribute ${attr.key} may already be provisioning`);
  }
}

async function ensureEmailIndex() {
  try {
    await databases.getIndex(DB_ID, COLLECTIONS.USER_PROFILES, 'email_unique');
    console.log('  ✓ Index exists: email_unique');
  } catch {
    try {
      await databases.createIndex(DB_ID, COLLECTIONS.USER_PROFILES, 'email_unique', 'unique', ['email']);
      console.log('  + Index: email_unique');
    } catch {
      console.log('  ~ Index email_unique may already be provisioning');
    }
  }
}

async function ensureCollection(id: string, name: string, attributes: AttributeConfig[]) {
  try {
    await databases.getCollection(DB_ID, id);
    console.log(`✓ Collection exists: ${id}`);
  } catch {
    await databases.createCollection(DB_ID, id, name, [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
      Permission.read(Role.any()),
      Permission.create(Role.any()),
      Permission.update(Role.any()),
      Permission.delete(Role.any()),
    ]);
    console.log(`+ Created collection: ${id}`);
    await waitForAttributes();
  }

  for (const attr of attributes) {
    await ensureAttribute(id, attr);
  }
  await waitForAttributes();
}

async function main() {
  console.log('Setting up Appwrite collections...\n');

  await ensureCollection(COLLECTIONS.USER_PROFILES, 'User Profiles', [
    { key: 'email', type: 'string', size: 255, required: true },
    { key: 'fullName', type: 'string', size: 255, required: true },
    { key: 'preferredLanguage', type: 'string', size: 10, required: false, default: 'ar' },
    { key: 'passwordHash', type: 'string', size: 255, required: false },
  ]);
  await ensureEmailIndex();

  await ensureCollection(COLLECTIONS.USER_MEDICATIONS, 'User Medications', [
    { key: 'userId', type: 'string', size: 64, required: true },
    { key: 'name', type: 'string', size: 255, required: true },
    { key: 'dosage', type: 'string', size: 128, required: false },
    { key: 'activeIngredient', type: 'string', size: 255, required: false },
    { key: 'form', type: 'string', size: 128, required: false },
    { key: 'instructions', type: 'string', size: 1000, required: false },
    { key: 'prescribedBy', type: 'string', size: 255, required: false },
    { key: 'startDate', type: 'string', size: 64, required: false },
    { key: 'endDate', type: 'string', size: 64, required: false },
    { key: 'isActive', type: 'boolean', required: false, default: true },
    { key: 'notes', type: 'string', size: 2000, required: false },
  ]);

  await ensureCollection(COLLECTIONS.REMINDERS, 'Reminders', [
    { key: 'userId', type: 'string', size: 64, required: true },
    { key: 'medicationId', type: 'string', size: 64, required: true },
    { key: 'time', type: 'string', size: 16, required: true },
    { key: 'frequency', type: 'string', size: 32, required: false, default: 'daily' },
    { key: 'daysOfWeek', type: 'string', size: 128, required: false },
    { key: 'isActive', type: 'boolean', required: false, default: true },
  ]);

  await ensureCollection(COLLECTIONS.REMINDER_COMPLETIONS, 'Reminder Completions', [
    { key: 'reminderId', type: 'string', size: 64, required: true },
    { key: 'status', type: 'string', size: 32, required: false, default: 'taken' },
    { key: 'completedAt', type: 'string', size: 64, required: false },
  ]);

  await ensureCollection(COLLECTIONS.ANALYSIS_REPORTS, 'Analysis Reports', [
    { key: 'userId', type: 'string', size: 64, required: true },
    { key: 'medicationId', type: 'string', size: 64, required: false },
    { key: 'medications', type: 'string', size: 2000, required: true },
    { key: 'symptoms', type: 'string', size: 1000, required: false },
    { key: 'notes', type: 'string', size: 2000, required: false },
    { key: 'results', type: 'string', size: 10000, required: true },
    { key: 'riskLevel', type: 'string', size: 32, required: false, default: 'low' },
    { key: 'safetyScore', type: 'integer', required: false, default: 70 },
    { key: 'language', type: 'string', size: 10, required: false, default: 'ar' },
  ]);

  await ensureCollection(COLLECTIONS.SCAN_HISTORIES, 'Scan Histories', [
    { key: 'userId', type: 'string', size: 64, required: true },
    { key: 'imageUrl', type: 'string', size: 500, required: false },
    { key: 'detectedMedications', type: 'string', size: 5000, required: true },
    { key: 'analysisResults', type: 'string', size: 10000, required: false },
  ]);

  await ensureCollection(COLLECTIONS.PASSWORD_RESETS, 'Password Resets', [
    { key: 'userId', type: 'string', size: 64, required: true },
    { key: 'code', type: 'string', size: 16, required: true },
    { key: 'expiresAt', type: 'string', size: 64, required: true },
    { key: 'used', type: 'boolean', required: false, default: false },
  ]);

  console.log('\n✅ Appwrite setup complete!');
}

main().catch(console.error);
