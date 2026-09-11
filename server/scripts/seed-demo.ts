import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/services/appwriteDb.service';

const DEMO_EMAIL = 'demo@medihealth.app';
const DEMO_PASSWORD = 'Demo123!';
const DEMO_NAME = 'حساب تجريبي';

async function main() {
  console.log('Seeding demo account...\n');

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
