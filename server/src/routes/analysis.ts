import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../services/appwriteDb.service';
import { aiService } from '../services/ai.service';
import { webResearchService } from '../services/webResearch.service';

const router = Router();

router.use(authenticate);

router.get('/', async (req: any, res: any) => {
  try {
    const limit = parseInt(req.query.limit || '20');
    const offset = parseInt(req.query.offset || '0');
    const reports = await db.getAnalysisReports(req.userId, limit, offset);

    res.json({
      reports: reports.map((r: any) => ({
        id: r.$id,
        medications: db.parseJsonField(r.medications, { names: [] }),
        symptoms: r.symptoms,
        notes: r.notes,
        results: db.parseJsonField(r.results, {}),
        riskLevel: r.riskLevel,
        safetyScore: r.safetyScore,
        language: r.language,
        createdAt: r.$createdAt,
      })),
    });
  } catch (error) {
    console.error('Fetch analysis history error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis history' });
  }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const report = await db.getAnalysisReport(req.params.id, req.userId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    res.json({
      report: {
        id: report.$id,
        medications: db.parseJsonField(report.medications, { names: [] }),
        symptoms: report.symptoms,
        notes: report.notes,
        results: db.parseJsonField(report.results, {}),
        riskLevel: report.riskLevel,
        safetyScore: report.safetyScore,
        language: report.language,
        createdAt: report.$createdAt,
      },
    });
  } catch (error) {
    console.error('Fetch analysis report error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

router.post('/analyze', async (req: any, res: any) => {
  try {
    const { medications, symptoms, notes, language } = req.body;
    const lang = language || 'ar';

    let verifiedContext: string | undefined;
    let verificationAvailable = false;

    try {
      if (medications?.length > 0 || symptoms) {
        const medicalContext = await webResearchService.buildMedicalContext(medications, symptoms);
        verifiedContext = medicalContext.context;
        verificationAvailable = medicalContext.verificationAvailable;
      }
    } catch (error) {
      console.warn('Web research failed:', error);
    }

    const result = await aiService.analyzeMedications({
      medications,
      symptoms,
      notes,
      language: lang,
      verifiedContext,
      verificationAvailable,
    });

    const userMeds = await db.getUserMedications(req.userId);
    const matchedMed = userMeds.find((m: any) =>
      medications.some((name: string) => (m.name as string).toLowerCase().includes(name.toLowerCase()))
    );

    const report = await db.createAnalysisReport(req.userId, {
      medicationId: matchedMed?.$id || null,
      medications: JSON.stringify({ names: medications }),
      symptoms: symptoms || '',
      notes: notes || '',
      results: JSON.stringify(result),
      riskLevel: result.riskLevel,
      safetyScore: result.score,
      language: lang,
    });

    res.status(201).json({
      report: {
        id: report.$id,
        medications: { names: medications },
        results: result,
        riskLevel: result.riskLevel,
        safetyScore: result.score,
        createdAt: report.$createdAt,
      },
      result,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

router.delete('/:id', async (req: any, res: any) => {
  try {
    const report = await db.getAnalysisReport(req.params.id, req.userId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    await db.deleteAnalysisReport(req.params.id);
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

export default router;
