import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../services/appwriteDb.service';

const router = Router();

router.use(authenticate);

router.get('/', async (req: any, res: any) => {
  try {
    const profile = await db.getUserProfile(req.userId);
    if (!profile) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: req.userId,
        email: (profile as any).email,
        fullName: (profile as any).fullName,
        preferredLanguage: (profile as any).preferredLanguage,
        createdAt: profile.$createdAt,
      },
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/', async (req: any, res: any) => {
  try {
    const { fullName, preferredLanguage } = req.body;
    const data: Record<string, unknown> = {};

    if (fullName) data.fullName = fullName;
    if (preferredLanguage) data.preferredLanguage = preferredLanguage;

    const profile = await db.updateUserProfile(req.userId, data);

    res.json({
      user: {
        id: req.userId,
        email: (profile as any).email,
        fullName: (profile as any).fullName,
        preferredLanguage: (profile as any).preferredLanguage,
        createdAt: profile.$createdAt,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/dashboard', async (req: any, res: any) => {
  try {
    const [medications, reminders, reports, scans] = await Promise.all([
      db.getUserMedications(req.userId),
      db.getReminders(req.userId),
      db.getAnalysisReports(req.userId, 5),
      db.getScanHistories(req.userId, 3),
    ]);

    const activeMeds = (medications as any[]).filter((m: any) => m.isActive !== false);
    const medById = new Map((medications as any[]).map((m: any) => [m.$id, m]));

    const upcomingReminders = (reminders as any[])
      .filter((r: any) => r.isActive !== false)
      .slice(0, 5)
      .map((r: any) => {
        const med = r.medicationId ? medById.get(r.medicationId) : null;
        return {
          ...r,
          id: r.$id,
          medication: med ? { id: med.$id, name: med.name, dosage: med.dosage } : null,
        };
      });

    const scores = reports.map((r: any) => Number(r.safetyScore) || 70);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 85;

    res.json({
      activeMedications: activeMeds.slice(0, 5),
      upcomingReminders,
      recentAnalyses: reports.slice(0, 3).map((r: any) => ({
        id: r.$id,
        medications: db.parseJsonField(r.medications, { names: [] }),
        safetyScore: r.safetyScore,
        riskLevel: r.riskLevel,
        createdAt: r.$createdAt,
      })),
      recentScans: scans,
      safetyScore: avgScore,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
