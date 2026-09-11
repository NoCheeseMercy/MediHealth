import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Client, Users, Query } from 'node-appwrite';
import { db } from '../src/services/appwriteDb.service';

const DEMO_EMAIL = 'demo@medihealth.app';
const DEMO_PASSWORD = 'Demo123!';
const DEMO_NAME = 'حساب تجريبي';

/**
 * The mobile client authenticates through Appwrite Auth, not the profiles
 * collection — the original seed only wrote a bcrypt hash into user_profiles,
 * which the Express flow read. Without an Auth user, "Enter Demo" fails with
 * invalid credentials no matter how complete the profile data is.
 */
async function ensureAuthUser() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID || '')
    .setKey(process.env.APPWRITE_API_KEY || '');
  const users = new Users(client);

  try {
    // Query strings must be Appwrite's `equal(...)` format — `email="..."` is
    // invalid, throws, and (with the old catch) silently fell through to create.
    const existing = await users.list([Query.equal('email', DEMO_EMAIL)]);
    if (existing.total > 0) {
      console.log('  Appwrite Auth user already exists');
      return existing.users[0].$id;
    }
  } catch {
    // fall through and attempt creation
  }

  try {
    // node-appwrite v17 signature: create(userId, email?, phone?, password?, name?).
    const user = await users.create('unique()', DEMO_EMAIL, null, DEMO_PASSWORD, DEMO_NAME);
    console.log(`  Created Appwrite Auth user: ${user.$id}`);
    return user.$id;
  } catch (e: any) {
    // Race with an existing account: user_already_exists means we're done.
    if (e?.code === 409 || e?.type === 'user_already_exists') {
      console.log('  Appwrite Auth user already exists');
      return 'existing';
    }
    throw e;
  }

  // node-appwrite v17 signature: create(userId, email?, phone?, password?, name?).
  const user = await users.create('unique()', DEMO_EMAIL, null, DEMO_PASSWORD, DEMO_NAME);
  console.log(`  Created Appwrite Auth user: ${user.$id}`);
  return user.$id;
}

async function main() {
  console.log('Seeding demo account...\n');

  await ensureAuthUser();

  const existingProfiles = await db.listUserProfiles(DEMO_EMAIL);
  let profile = existingProfiles.find((p: any) => p.email === DEMO_EMAIL);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  if (profile) {
    await db.updateUserProfile((profile as any).$id, {
      fullName: DEMO_NAME,
      preferredLanguage: 'ar',
      passwordHash,
    });
    profile = await db.getUserProfile((profile as any).$id);
    console.log(`Demo profile exists: ${(profile as any).$id}`);
  } else {
    profile = await db.createUserProfile({
      userId: crypto.randomUUID(),
      email: DEMO_EMAIL,
      fullName: DEMO_NAME,
      preferredLanguage: 'ar',
      passwordHash,
    });
    console.log(`Created demo profile: ${(profile as any).$id}`);
  }

  const userId = (profile as any).$id;
  let existingMeds = await db.getUserMedications(userId);
  const meds = [
    { name: 'Metformin', dosage: '500mg', activeIngredient: 'Metformin HCl', form: 'Tablet', instructions: 'Take with meals twice daily', isActive: true },
    { name: 'Lisinopril', dosage: '10mg', activeIngredient: 'Lisinopril', form: 'Tablet', instructions: 'Take once daily in the morning', isActive: true },
    { name: 'Atorvastatin', dosage: '20mg', activeIngredient: 'Atorvastatin Calcium', form: 'Tablet', instructions: 'Take at bedtime', isActive: true },
    { name: 'Aspirin', dosage: '81mg', activeIngredient: 'Acetylsalicylic Acid', form: 'Tablet', instructions: 'Take once daily', isActive: true },
  ];

  if (existingMeds.length === 0) {
    const createdMeds = [];
    for (const med of meds) {
      const doc = await db.createUserMedication(userId, med);
      createdMeds.push(doc);
      console.log(`  Medication: ${med.name}`);
    }
    existingMeds = createdMeds;
  }

  const existingReminders = await db.getReminders(userId);
  if (existingReminders.length === 0) {
    for (const med of existingMeds) {
      await db.createReminder(userId, {
        medicationId: med.$id,
        medicationName: med.name,
        time: '08:00',
        frequency: 'daily',
        daysOfWeek: '[]',
        days: '[]',
        enabled: true,
        isActive: true,
      });
      await db.createReminder(userId, {
        medicationId: med.$id,
        medicationName: med.name,
        time: '20:00',
        frequency: 'daily',
        daysOfWeek: '[]',
        days: '[]',
        enabled: true,
        isActive: true,
      });
    }
    console.log('  Reminders created');

    const demoAnalysis = {
      score: 72,
      riskLevel: 'moderate',
      safetyCategory: 'monitor',
      interactions: [
        { drug: 'Metformin + Lisinopril', severity: 'moderate', description: 'Both may affect kidney function — monitor renal labs' },
        { drug: 'Aspirin + Atorvastatin', severity: 'low', description: 'Generally safe combination for cardiovascular protection' },
      ],
      sideEffects: [
        { symptom: 'Nausea', likelihood: 'common', description: 'Common with Metformin' },
        { symptom: 'Dry cough', likelihood: 'uncommon', description: 'Possible with Lisinopril' },
      ],
      foodInteractions: [
        { food: 'Grapefruit', advice: 'Avoid grapefruit with Atorvastatin — increases drug levels' },
        { food: 'Alcohol', advice: 'Limit alcohol with Metformin — lactic acidosis risk' },
      ],
      safetyConcerns: ['Monitor blood pressure and kidney function regularly'],
      recommendations: ['Consult your physician about aspirin use with your current regimen', 'Take Metformin with food to reduce GI side effects'],
      verificationAvailable: true,
      disclaimer: 'هذا التحليل لأغراض إعلامية فقط.',
    };

    await db.createAnalysisReport(userId, {
      medications: JSON.stringify({ names: ['Metformin', 'Lisinopril', 'Atorvastatin', 'Aspirin'] }),
      symptoms: 'تعب خفيف، دوخة أحياناً',
      notes: 'Demo analysis for judges',
      results: JSON.stringify(demoAnalysis),
      riskLevel: 'moderate',
      safetyScore: 72,
      language: 'ar',
    });

    await db.createScanHistory(userId, {
      imageUrl: 'demo_scan',
      detectedMedications: JSON.stringify([
        { name: 'Metformin', dosage: '500mg', activeIngredient: 'Metformin HCl' },
        { name: 'Lisinopril', dosage: '10mg', activeIngredient: 'Lisinopril' },
      ]),
      analysisResults: JSON.stringify(demoAnalysis),
    });

    console.log('  Analysis & scan history created');
  } else {
    console.log('  Demo data already exists');
  }

  console.log('\nDemo seed complete!');
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
}

main().catch(console.error);
