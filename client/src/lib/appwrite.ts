import { Client, Account, Databases, ID, Query } from 'appwrite';

const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = '6a34658e002f0f18b040';
const APPWRITE_DATABASE_ID = '6a3469eb002697b97c06';

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const dbId = APPWRITE_DATABASE_ID;
export const projectId = APPWRITE_PROJECT_ID;
export { ID, Query };

export const COLLECTIONS = {
  USER_PROFILES: 'user_profiles',
  MEDICATIONS: 'user_medications',
  REMINDERS: 'reminders',
  REMINDER_COMPLETIONS: 'reminder_completions',
  ANALYSIS_REPORTS: 'analysis_reports',
  SCAN_HISTORIES: 'scan_histories',
} as const;
