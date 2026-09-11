import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../services/appwriteDb.service';

const router = Router();

router.use(authenticate);

router.get('/dashboard', async (req: any, res: any) => {
  try {
    const [medications, reminders, reports, scans] = await Promise.all([
      db.getUserMedications(req.userId),
      db.getReminders(req.userId),
      db.getAnalysisReports(req.userId, 5),
      db.getScanHistories(req.userId, 3),
    ]);

    const activeMeds = (medications as any[]).filter((m: any) => m.isActive !== false);
    const activeReminders = (reminders as any[]).filter((r: any) => r.isActive !== false).slice(0, 5);

    const scores = reports.map((r: any) => Number(r.safetyScore) || 70);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 85;

    res.json({
      activeMedications: activeMeds.slice(0, 5),
      upcomingReminders: activeReminders.map((r: any) => ({
        ...r,
        id: r.$id,
        completedCount: 0,
      })),
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
