import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { account, databases, dbId, COLLECTIONS, ID, Query } from '../lib/appwrite';

let currentUserId: string | null = null;
let currentUserEmail: string | null = null;
let currentUserProfile: { $id: string; email: string; fullName: string; preferredLanguage: string } | null = null;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return fallback; } }
  return (value ?? fallback) as T;
}

function mapDoc(doc: any) {
  if (!doc) return null;
  return { ...doc, id: doc.$id };
}

const api = {
  async init() {
    try {
      const stored = await AsyncStorage.getItem('appwrite_user');
      if (stored) currentUserProfile = JSON.parse(stored);
    } catch { /* no session */ }
  },

  getSessionUserId() { return currentUserProfile?.$id || null; },

  async setSessionFromAppwrite(profile: typeof currentUserProfile) {
    currentUserProfile = profile;
    if (profile) await AsyncStorage.setItem('appwrite_user', JSON.stringify(profile));
    else { await AsyncStorage.removeItem('appwrite_user'); await AsyncStorage.removeItem('auth_token'); }
  },

  hasToken() { return !!currentUserProfile; },

  // ── Compat .get / .post interceptors ──────────────────

  async get(route: string): Promise<any> {
    const uid = currentUserProfile?.$id;
    if (!uid) throw new Error('Not authenticated');

    if (route === '/auth/me') return this.me();

    if (route === '/profile/dashboard') return this.dashboard();

    if (route === '/medications') return this.listMedications();
    if (route.match(/^\/medications\/(.+)$/)) return this.getMedication(route.match(/^\/medications\/(.+)$/)![1]);

    if (route === '/analysis') return this.listAnalyses();
    if (route.match(/^\/analysis\/(.+)$/)) return this.getAnalysis(route.match(/^\/analysis\/(.+)$/)![1]);

    if (route === '/reminders') return this.listReminders();
    if (route.match(/^\/reminders\/medication\/(.+)$/)) return this.listRemindersByMedication(route.match(/^\/reminders\/medication\/(.+)$/)![1]);

    throw new Error(`Unknown GET route: ${route}`);
  },

  async post(route: string, body?: any): Promise<any> {
    const uid = currentUserProfile?.$id;
    if (!uid && route !== '/auth/register' && route !== '/auth/login') throw new Error('Not authenticated');

    if (route === '/auth/register') return this.register(body);
    if (route === '/auth/login') return this.login(body);
    // These three used to return `{ message: 'not available in client mode' }`,
    // which the Settings screen rendered as a green "Password changed" success
    // alert after silently changing nothing. Wired to the real Appwrite calls.
    if (route === '/auth/forgot-password') return this.forgotPassword(body?.email);
    if (route === '/auth/reset-password') return this.resetPassword(body);
    if (route === '/auth/change-password') return this.changePassword(body);

    if (route === '/medications') return this.createMedication(body);
    if (route === '/analysis/analyze') return this.analyze(body);

    if (route === '/reminders') return this.createReminder(body);
    if (route.match(/^\/reminders\/([^/]+)\/complete$/)) {
      const match = route.match(/^\/reminders\/([^/]+)\/complete$/);
      return this.completeReminder(match![1], body?.status || 'taken');
    }

    if (route === '/scan/extract') {
      // Was a hardcoded `{ medications: [] }` stub, so the scanner's Detect
      // button always reported "nothing found" even though extractFromImage()
      // is implemented a few lines below in this same file.
      const meds = await this.extractFromImage(body?.imageData);
      return { medications: meds };
    }
    if (route === '/scan/analyze') return this.scanAnalyze(body);

    throw new Error(`Unknown POST route: ${route}`);
  },

  async patch(route: string, body?: any): Promise<any> {
    const uid = currentUserProfile?.$id;
    if (!uid) throw new Error('Not authenticated');
    if (route === '/profile') return this.updateProfile(body);
    if (route.match(/^\/reminders\/(.+)$/)) return this.updateReminder(route.match(/^\/reminders\/(.+)$/)![1], body);
    throw new Error(`Unknown PATCH route: ${route}`);
  },

  async delete(route: string): Promise<any> {
    const uid = currentUserProfile?.$id;
    if (!uid) throw new Error('Not authenticated');
    if (route.match(/^\/medications\/(.+)$/)) return this.deleteMedication(route.match(/^\/medications\/(.+)$/)![1]);
    if (route.match(/^\/analysis\/(.+)$/)) return this.deleteAnalysis(route.match(/^\/analysis\/(.+)$/)![1]);
    if (route.match(/^\/reminders\/(.+)$/)) return this.deleteReminder(route.match(/^\/reminders\/(.+)$/)![1]);
    throw new Error(`Unknown DELETE route: ${route}`);
  },

  async setToken(_: string | null) { /* no-op, keeping compatibility */ },

  async put(route: string, body?: any): Promise<any> {
    if (route.match(/^\/medications\/(.+)$/)) {
      const id = route.match(/^\/medications\/(.+)$/)![1];
      const doc = await databases.updateDocument(dbId, COLLECTIONS.MEDICATIONS, id, body);
      return { medication: mapDoc(doc) };
    }
    throw new Error(`Unknown PUT route: ${route}`);
  },

  // ── Auth ────────────────────────────────────────────────

  async register(body: any) {
    const { email, password, fullName, preferredLanguage } = body;
    const userId = ID.unique();
    await account.create(userId, email, password, fullName);
    await account.createEmailPasswordSession(email, password);
    const profile = await databases.createDocument(dbId, COLLECTIONS.USER_PROFILES, userId, {
      email, fullName, preferredLanguage: preferredLanguage || 'ar',
    });
    const u = { $id: userId, email, fullName, preferredLanguage: preferredLanguage || 'ar' };
    await this.setSessionFromAppwrite(u);
    return { user: { id: userId, email, fullName, preferredLanguage: preferredLanguage || 'ar' }, token: 'appwrite_session' };
  },

  async login(body: any) {
    const { email, password } = body;
    await account.createEmailPasswordSession(email, password);
    const profiles = await databases.listDocuments(dbId, COLLECTIONS.USER_PROFILES, [Query.equal('email', email)]);
    const p = profiles.documents[0];
    const fullName = (p?.fullName as string) || email.split('@')[0];
    const prefLang = (p?.preferredLanguage as string) || 'ar';
    const u = { $id: p?.$id || email, email, fullName, preferredLanguage: prefLang };
    await this.setSessionFromAppwrite(u);
    return { user: { id: u.$id, email, fullName, preferredLanguage: prefLang }, token: 'appwrite_session' };
  },

  async logout() {
    try { await account.deleteSession('current'); } catch { /* ok */ }
    await this.setSessionFromAppwrite(null);
  },

  async me() {
    const acct = await account.get();
    const profiles = await databases.listDocuments(dbId, COLLECTIONS.USER_PROFILES, [Query.equal('email', acct.email)]);
    const p = profiles.documents[0];
    const fullName = (p?.fullName as string) || acct.name;
    const prefLang = (p?.preferredLanguage as string) || 'ar';
    return { user: { id: p?.$id || acct.$id, email: acct.email, fullName, preferredLanguage: prefLang } };
  },

  async changePassword({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) {
    if (!currentPassword || !newPassword) throw new Error('Current and new password are both required');
    // Appwrite's updatePassword verifies the current one server-side, so a wrong
    // password throws rather than silently succeeding.
    await account.updatePassword(newPassword, currentPassword);
    return { message: 'Password changed' };
  },

  async forgotPassword(email?: string) {
    if (!email) throw new Error('Email is required');
    const recoveryUrl = Linking.createURL('/reset-password');
    const res = await account.createRecovery(email, recoveryUrl);
    // Appwrite only mails this if the project has a mail provider configured;
    // a successful call with no provider still throws upstream, so reaching here
    // means the email was accepted.
    return { message: 'Recovery email sent', $id: res.$id };
  },

  async resetPassword({ userId, secret, newPassword }: { userId?: string; secret?: string; newPassword: string }) {
    if (!userId || !secret || !newPassword) throw new Error('Reset link is incomplete — please request a new one');
    await account.updateRecovery(userId, secret, newPassword);
    return { message: 'Password reset' };
  },

  // ── Profile ────────────────────────────────────────────

  async updateProfile(data: any) {
    const uid = currentUserProfile?.$id;
    if (!uid) throw new Error('Not authenticated');
    const doc = await databases.updateDocument(dbId, COLLECTIONS.USER_PROFILES, uid, data);
    return { user: { id: doc.$id, email: doc.email, fullName: doc.fullName, preferredLanguage: doc.preferredLanguage } };
  },

  // ── Dashboard ──────────────────────────────────────────

  async dashboard() {
    const uid = currentUserProfile?.$id;
    if (!uid) throw new Error('Not authenticated');
    const [medsRes, remindersRes, analysesRes, scansRes] = await Promise.all([
      databases.listDocuments(dbId, COLLECTIONS.MEDICATIONS, [Query.equal('userId', uid!), Query.limit(100)]),
      databases.listDocuments(dbId, COLLECTIONS.REMINDERS, [Query.equal('userId', uid!), Query.limit(100)]),
      databases.listDocuments(dbId, COLLECTIONS.ANALYSIS_REPORTS, [Query.equal('userId', uid!), Query.orderDesc('$createdAt'), Query.limit(5)]),
      databases.listDocuments(dbId, COLLECTIONS.SCAN_HISTORIES, [Query.equal('userId', uid!), Query.orderDesc('$createdAt'), Query.limit(3)]),
    ]);
    const scores = analysesRes.documents.map((r: any) => Number(r.safetyScore) || 70);
    return {
      activeMedications: medsRes.documents.filter((m: any) => m.isActive !== false).slice(0, 5).map(mapDoc),
      upcomingReminders: remindersRes.documents.filter((r: any) => r.isActive !== false).slice(0, 5).map((r: any) => ({
        ...r, id: r.$id, medication: r.medicationId ? { name: r.medicationName || '' } : null,
      })),
      recentAnalyses: analysesRes.documents.slice(0, 3).map((r: any) => ({
        id: r.$id, medications: parseJson(r.medications, { names: [] }),
        safetyScore: r.safetyScore, riskLevel: r.riskLevel, createdAt: r.$createdAt,
      })),
      recentScans: scansRes.documents.slice(0, 3).map(mapDoc),
      safetyScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 85,
    };
  },

  // ── Medications ────────────────────────────────────────

  async listMedications() {
    const uid = currentUserProfile?.$id;
    const res = await databases.listDocuments(dbId, COLLECTIONS.MEDICATIONS, [Query.equal('userId', uid!), Query.orderDesc('$createdAt'), Query.limit(100)]);
    return { medications: res.documents.map(mapDoc) };
  },

  async getMedication(id: string) {
    const doc = await databases.getDocument(dbId, COLLECTIONS.MEDICATIONS, id);
    return { medication: mapDoc(doc) };
  },

  async createMedication(data: any) {
    const uid = currentUserProfile?.$id;
    const doc = await databases.createDocument(dbId, COLLECTIONS.MEDICATIONS, ID.unique(), { userId: uid, ...data });
    return { medication: mapDoc(doc) };
  },

  async deleteMedication(id: string) {
    await databases.deleteDocument(dbId, COLLECTIONS.MEDICATIONS, id);
    return { message: 'Deleted' };
  },

  // ── Analysis ───────────────────────────────────────────

  async listAnalyses() {
    const uid = currentUserProfile?.$id;
    const res = await databases.listDocuments(dbId, COLLECTIONS.ANALYSIS_REPORTS, [Query.equal('userId', uid!), Query.orderDesc('$createdAt'), Query.limit(20)]);
    return {
      reports: res.documents.map((r: any) => ({
        id: r.$id, medications: parseJson(r.medications, { names: [] }),
        symptoms: r.symptoms, notes: r.notes,
        results: parseJson(r.results, {}), riskLevel: r.riskLevel,
        safetyScore: r.safetyScore, language: r.language, createdAt: r.$createdAt,
      })),
    };
  },

  async getAnalysis(id: string) {
    const doc = await databases.getDocument(dbId, COLLECTIONS.ANALYSIS_REPORTS, id);
    return {
      report: {
        id: doc.$id, medications: parseJson(doc.medications, { names: [] }),
        symptoms: doc.symptoms, notes: doc.notes,
        results: parseJson(doc.results, {}), riskLevel: doc.riskLevel,
        safetyScore: doc.safetyScore, language: doc.language, createdAt: doc.$createdAt,
      },
    };
  },

  async createAnalysis(data: any) {
    const uid = currentUserProfile?.$id;
    const { medications, symptoms, notes, language } = data;
    const resData = data.results ? (typeof data.results === 'string' ? parseJson(data.results, {}) : data.results) : {};
    const doc = await databases.createDocument(dbId, COLLECTIONS.ANALYSIS_REPORTS, ID.unique(), {
      userId: uid, medications: JSON.stringify({ names: medications || [] }),
      symptoms: symptoms || '', notes: notes || '',
      results: JSON.stringify(resData), riskLevel: resData.riskLevel || 'low',
      safetyScore: resData.score || 70, language: language || 'ar',
    });
    return { report: { id: doc.$id }, result: resData };
  },

  async deleteAnalysis(id: string) {
    await databases.deleteDocument(dbId, COLLECTIONS.ANALYSIS_REPORTS, id);
    return { message: 'Deleted' };
  },

  // ── Analysis (AI) ──────────────────────────────────────

  async analyze(body: any) {
    const { medications, symptoms, notes, language } = body;
    const result = await this.callAiAnalysis({ medications, symptoms, notes, language });
    const report = await this.createAnalysis({ medications, symptoms, notes, language, results: result });
    return { ...report, result };
  },

  /**
   * All AI calls go through the Cloudflare Worker proxy (worker/ in this repo).
   * The NVIDIA key never ships in the app bundle — the previous design used
   * EXPO_PUBLIC_NIM_API_KEY, which is compiled into the APK and extractable by
   * anyone who unzips it.
   */
  async nimProxy(route: '/analyze' | '/extract', payload: Record<string, unknown>) {
    const base = process.env.EXPO_PUBLIC_AI_PROXY_URL;
    if (!base) throw new Error('AI proxy not configured. Set EXPO_PUBLIC_AI_PROXY_URL (see worker/README).');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const shared = process.env.EXPO_PUBLIC_AI_SHARED_SECRET;
    if (shared) headers['x-mh-secret'] = shared;

    // Hermes (React Native's JS engine) does not implement AbortSignal.timeout —
    // the expression threw TypeError before the request ever left the device.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(`${base.replace(/\/+$/, '')}${route}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || `AI service error (HTTP ${response.status})`);
      }
      return (data as { content: string }).content;
    } finally {
      clearTimeout(timer);
    }
  },

  parseAnalysisResult(content: string, isAr: boolean) {
    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(content || '{}');
    } catch {
      throw new Error('Could not read the AI response. Try again.');
    }
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 70)));
    const riskLevel = score >= 75 ? 'low' : (score >= 50 ? 'moderate' : 'high');
    return {
      score, riskLevel, safetyCategory: score >= 80 ? 'safe' : (score >= 60 ? 'monitor' : (score >= 40 ? 'warning' : 'high_risk')),
      interactions: parsed.interactions || [], sideEffects: parsed.sideEffects || [],
      foodInteractions: parsed.foodInteractions || [], safetyConcerns: parsed.safetyConcerns || [],
      recommendations: parsed.recommendations || [], verificationAvailable: false,
      disclaimer: isAr ? 'هذا التحليل لأغراض إعلامية فقط وليس بديلاً عن المشورة الطبية المهنية.' : 'This analysis is for informational purposes only.',
    };
  },

  async callAiAnalysis(request: { medications: string[]; symptoms?: string; notes?: string; language: string }) {
    const isAr = request.language === 'ar';
    const content = await this.nimProxy('/analyze', {
      medications: request.medications,
      symptoms: request.symptoms || '',
      notes: request.notes || '',
      language: request.language,
    });
    return this.parseAnalysisResult(content, isAr);
  },

  // ── Scan ────────────────────────────────────────────────

  async scanAnalyze(body: any) {
    const { imageData, symptoms, notes, language } = body;
    if (!imageData) throw new Error('Image data is required');
    const uid = currentUserProfile?.$id;
    const extracted = await this.extractFromImage(imageData);
    if (!extracted || extracted.length === 0) throw new Error('No medications detected in image.');
    const medicationNames = extracted.map((m: any) => m.name);
    const result = await this.callAiAnalysis({ medications: medicationNames, symptoms, notes, language: language || 'ar' });
    const scan = await databases.createDocument(dbId, COLLECTIONS.SCAN_HISTORIES, ID.unique(), {
      userId: uid, imageUrl: 'image_captured', detectedMedications: JSON.stringify(extracted), analysisResults: JSON.stringify(result),
    });
    const report = await databases.createDocument(dbId, COLLECTIONS.ANALYSIS_REPORTS, ID.unique(), {
      userId: uid, medications: JSON.stringify({ names: medicationNames }), symptoms: symptoms || '', notes: notes || '',
      results: JSON.stringify(result), riskLevel: result.riskLevel, safetyScore: result.score, language: language || 'ar',
    });
    return { scan: { id: scan.$id, detectedMedications: extracted }, report: { id: report.$id }, result, detectedMedications: extracted };
  },

  async extractFromImage(imageData: string) {
    if (!imageData) throw new Error('Image data is required');
    const text = await this.nimProxy('/extract', { imageData });

    // Previously every failure path collapsed into `return []`, so a dropped
    // connection, an exhausted quota and an unreadable label all reported the
    // same "no medications recognized" — which sent users to retake a photo
    // that was already fine.
    let parsed: unknown;
    try {
      parsed = JSON.parse(text || '[]');
    } catch {
      throw new Error('Could not read the label clearly. Try a steadier, better-lit photo.');
    }

    return Array.isArray(parsed) ? parsed.filter((m: any) => m?.name) : [];
  },

  // ── Reminders ──────────────────────────────────────────

  async listReminders() {
    const uid = currentUserProfile?.$id;
    const res = await databases.listDocuments(dbId, COLLECTIONS.REMINDERS, [Query.equal('userId', uid!), Query.orderDesc('$createdAt'), Query.limit(100)]);
    return {
      reminders: res.documents.map((r: any) => ({
        ...r, id: r.$id,
        medication: r.medicationId ? { name: r.medicationName || '', dosage: null } : null,
        completions: [],
      })),
    };
  },

  async listRemindersByMedication(medicationId: string) {
    const uid = currentUserProfile?.$id;
    const res = await databases.listDocuments(dbId, COLLECTIONS.REMINDERS, [Query.equal('userId', uid!), Query.equal('medicationId', medicationId)]);
    return { reminders: res.documents.map(mapDoc) };
  },

  async createReminder(data: any) {
    const uid = currentUserProfile?.$id;
    const days = data.daysOfWeek ? (Array.isArray(data.daysOfWeek) ? JSON.stringify(data.daysOfWeek) : data.daysOfWeek) : '[]';
    const medicationName = data.medicationName || '';
    const doc = await databases.createDocument(dbId, COLLECTIONS.REMINDERS, ID.unique(), {
      userId: uid, medicationId: data.medicationId || '', medicationName,
      time: data.time || '08:00', days, daysOfWeek: days, frequency: data.frequency || 'daily',
      enabled: true, isActive: true, notes: data.notes || '',
    });
    return { reminder: { ...doc, id: doc.$id } };
  },

  async updateReminder(id: string, data: any) {
    const updateData: Record<string, unknown> = {};
    if (data.isActive !== undefined) { updateData.isActive = data.isActive; updateData.enabled = data.isActive; }
    if (data.time) updateData.time = data.time;
    if (data.frequency) updateData.frequency = data.frequency;
    if (data.daysOfWeek) { const s = Array.isArray(data.daysOfWeek) ? JSON.stringify(data.daysOfWeek) : data.daysOfWeek; updateData.days = s; updateData.daysOfWeek = s; }
    const doc = await databases.updateDocument(dbId, COLLECTIONS.REMINDERS, id, updateData);
    return { reminder: { ...doc, id: doc.$id } };
  },

  async deleteReminder(id: string) {
    await databases.deleteDocument(dbId, COLLECTIONS.REMINDERS, id);
    return { message: 'Deleted' };
  },

  async completeReminder(id: string, status = 'taken') {
    const doc = await databases.createDocument(dbId, COLLECTIONS.REMINDER_COMPLETIONS, ID.unique(), {
      reminderId: id, status, completedAt: new Date().toISOString(),
    });
    return { completion: { ...doc, id: doc.$id } };
  },
};

export { api };
export default api;
