import { databases, DB_ID, COLLECTIONS, ID, Query } from '../lib/appwrite';

type Doc = Record<string, unknown>;

export class AppwriteDbService {
  async listUserProfiles(email?: string): Promise<Doc[]> {
    try {
      const queries: any[] = [Query.limit(100)];
      if (email) queries.push(Query.equal('email', email));
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.USER_PROFILES, queries);
      return res.documents;
    } catch {
      return [];
    }
  }

  async createUserProfile(data: {
    userId: string;
    email: string;
    fullName: string;
    preferredLanguage: string;
    passwordHash?: string;
  }): Promise<Doc> {
    return databases.createDocument(DB_ID, COLLECTIONS.USER_PROFILES, data.userId, {
      email: data.email,
      fullName: data.fullName,
      preferredLanguage: data.preferredLanguage,
      ...(data.passwordHash ? { passwordHash: data.passwordHash } : {}),
    });
  }

  async getUserProfile(userId: string): Promise<Doc | null> {
    try {
      return await databases.getDocument(DB_ID, COLLECTIONS.USER_PROFILES, userId);
    } catch {
      return null;
    }
  }

  async updateUserProfile(userId: string, data: Record<string, unknown>): Promise<Doc> {
    return databases.updateDocument(DB_ID, COLLECTIONS.USER_PROFILES, userId, data);
  }

  async getUserMedications(userId: string): Promise<Doc[]> {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.USER_MEDICATIONS, [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]);
    return res.documents;
  }

  async getUserMedication(id: string, userId: string): Promise<Doc | null> {
    try {
      const doc = await databases.getDocument(DB_ID, COLLECTIONS.USER_MEDICATIONS, id);
      if (doc.userId !== userId) return null;
      return doc;
    } catch {
      return null;
    }
  }

  async createUserMedication(userId: string, data: Record<string, unknown>): Promise<Doc> {
    return databases.createDocument(DB_ID, COLLECTIONS.USER_MEDICATIONS, ID.unique(), {
      userId,
      ...data,
    });
  }

  async updateUserMedication(id: string, data: Record<string, unknown>): Promise<Doc> {
    return databases.updateDocument(DB_ID, COLLECTIONS.USER_MEDICATIONS, id, data);
  }

  async deleteUserMedication(id: string): Promise<void> {
    await databases.deleteDocument(DB_ID, COLLECTIONS.USER_MEDICATIONS, id);
  }

  async getReminders(userId: string): Promise<Doc[]> {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.REMINDERS, [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]);
    return res.documents;
  }

  async getReminder(id: string, userId: string): Promise<Doc | null> {
    try {
      const doc = await databases.getDocument(DB_ID, COLLECTIONS.REMINDERS, id);
      if (doc.userId !== userId) return null;
      return doc;
    } catch {
      return null;
    }
  }

  async createReminder(userId: string, data: Record<string, unknown>): Promise<Doc> {
    return databases.createDocument(DB_ID, COLLECTIONS.REMINDERS, ID.unique(), {
      userId,
      ...data,
    });
  }

  async updateReminder(id: string, data: Record<string, unknown>): Promise<Doc> {
    return databases.updateDocument(DB_ID, COLLECTIONS.REMINDERS, id, data);
  }

  async deleteReminder(id: string): Promise<void> {
    await databases.deleteDocument(DB_ID, COLLECTIONS.REMINDERS, id);
  }

  async getReminderCompletions(reminderId: string): Promise<Doc[]> {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.REMINDER_COMPLETIONS, [
      Query.equal('reminderId', reminderId),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ]);
    return res.documents;
  }

  async createReminderCompletion(data: Record<string, unknown>): Promise<Doc> {
    return databases.createDocument(DB_ID, COLLECTIONS.REMINDER_COMPLETIONS, ID.unique(), data);
  }

  async getAnalysisReports(userId: string, limit = 20, offset = 0): Promise<Doc[]> {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.ANALYSIS_REPORTS, [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
      Query.offset(offset),
    ]);
    return res.documents;
  }

  async getAnalysisReport(id: string, userId: string): Promise<Doc | null> {
    try {
      const doc = await databases.getDocument(DB_ID, COLLECTIONS.ANALYSIS_REPORTS, id);
      if (doc.userId !== userId) return null;
      return doc;
    } catch {
      return null;
    }
  }

  async createAnalysisReport(userId: string, data: Record<string, unknown>): Promise<Doc> {
    return databases.createDocument(DB_ID, COLLECTIONS.ANALYSIS_REPORTS, ID.unique(), {
      userId,
      ...data,
    });
  }

  async deleteAnalysisReport(id: string): Promise<void> {
    await databases.deleteDocument(DB_ID, COLLECTIONS.ANALYSIS_REPORTS, id);
  }

  async getScanHistories(userId: string, limit = 20): Promise<Doc[]> {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.SCAN_HISTORIES, [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
    ]);
    return res.documents;
  }

  async createScanHistory(userId: string, data: Record<string, unknown>): Promise<Doc> {
    return databases.createDocument(DB_ID, COLLECTIONS.SCAN_HISTORIES, ID.unique(), {
      userId,
      ...data,
    });
  }

  async upsertPasswordReset(userId: string, code: string, expiresAt: string): Promise<Doc> {
    try {
      return await databases.updateDocument(DB_ID, COLLECTIONS.PASSWORD_RESETS, userId, {
        code,
        expiresAt,
        used: false,
      });
    } catch {
      return databases.createDocument(DB_ID, COLLECTIONS.PASSWORD_RESETS, userId, {
        userId,
        code,
        expiresAt,
        used: false,
      });
    }
  }

  async getPasswordReset(userId: string): Promise<Doc | null> {
    try {
      return await databases.getDocument(DB_ID, COLLECTIONS.PASSWORD_RESETS, userId);
    } catch {
      return null;
    }
  }

  async markPasswordResetUsed(userId: string): Promise<void> {
    await databases.updateDocument(DB_ID, COLLECTIONS.PASSWORD_RESETS, userId, { used: true });
  }

  parseJsonField<T>(value: unknown, fallback: T): T {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return (value as T) ?? fallback;
  }
}

export const db = new AppwriteDbService();
