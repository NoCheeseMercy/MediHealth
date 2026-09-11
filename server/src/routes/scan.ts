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
    const scans = await db.getScanHistories(req.userId, limit);

    res.json({
      scans: scans.map((s: any) => ({
        id: s.$id,
        imageUrl: s.imageUrl,
        detectedMedications: db.parseJsonField(s.detectedMedications, []),
        analysisResults: db.parseJsonField(s.analysisResults, null),
        createdAt: s.$createdAt,
      })),
    });
  } catch (error) {
    console.error('Fetch scan history error:', error);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
});

router.post('/extract', async (req: any, res: any) => {
  try {
    const { imageData } = req.body;
    if (!imageData) return res.status(400).json({ error: 'Image data is required' });

    const medications = await aiService.extractMedicationInfo(imageData);

    res.status(201).json({
      medications,
      message: medications.length > 0
        ? `${medications.length} medication(s) detected`
        : 'No medications detected. Please try a clearer photo.',
    });
  } catch (error) {
    console.error('Extract medication error:', error);
    res.status(500).json({ error: 'Failed to extract medication information.' });
  }
});

router.post('/analyze', async (req: any, res: any) => {
  try {
    const { imageData, symptoms, notes, language } = req.body;
    const lang = language || 'ar';

    if (!imageData) return res.status(400).json({ error: 'Image data is required' });

    const extracted = await aiService.extractMedicationInfo(imageData);
    const medicationNames = extracted.map((m) => m.name);

    if (medicationNames.length === 0) {
      return res.status(400).json({ error: 'No medications detected in image.' });
    }

    let verifiedContext: string | undefined;
    let verificationAvailable = false;

    try {
      const ctx = await webResearchService.buildMedicalContext(medicationNames, symptoms);
      verifiedContext = ctx.context;
      verificationAvailable = ctx.verificationAvailable;
    } catch {
      // continue
    }

    const result = await aiService.analyzeMedications({
      medications: medicationNames,
      symptoms,
      notes,
      language: lang,
      verifiedContext,
      verificationAvailable,
    });

    const scan = await db.createScanHistory(req.userId, {
      imageUrl: 'image_captured',
      detectedMedications: JSON.stringify(extracted),
      analysisResults: JSON.stringify(result),
    });

    const report = await db.createAnalysisReport(req.userId, {
      medications: JSON.stringify({ names: medicationNames }),
      symptoms: symptoms || '',
      notes: notes || '',
      results: JSON.stringify(result),
      riskLevel: result.riskLevel,
      safetyScore: result.score,
      language: lang,
    });

    res.status(201).json({
      scan: { id: scan.$id, detectedMedications: extracted },
      report: { id: report.$id },
      result,
      detectedMedications: extracted,
    });
  } catch (error) {
    console.error('Scan analyze error:', error);
    res.status(500).json({ error: 'Failed to process scan.' });
  }
});

export default router;
