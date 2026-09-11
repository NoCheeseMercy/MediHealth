import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../services/appwriteDb.service';

const router = Router();

router.use(authenticate);

router.get('/', async (req: any, res: any) => {
  try {
    const medications = await db.getUserMedications(req.userId);
    res.json({ medications });
  } catch (error) {
    console.error('Fetch medications error:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const medication = await db.getUserMedication(req.params.id, req.userId);
    if (!medication) return res.status(404).json({ error: 'Medication not found' });
    res.json({ medication });
  } catch (error) {
    console.error('Fetch medication error:', error);
    res.status(500).json({ error: 'Failed to fetch medication' });
  }
});

router.post('/', async (req: any, res: any) => {
  try {
    const { name, dosage, activeIngredient, form, instructions, prescribedBy, startDate, endDate, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Medication name is required' });
    }

    const medication = await db.createUserMedication(req.userId, {
      name,
      dosage: dosage || '',
      activeIngredient: activeIngredient || '',
      form: form || '',
      instructions: instructions || '',
      prescribedBy: prescribedBy || '',
      startDate: startDate || null,
      endDate: endDate || null,
      notes: notes || '',
      isActive: true,
    });

    res.status(201).json({ medication });
  } catch (error) {
    console.error('Create medication error:', error);
    res.status(500).json({ error: 'Failed to create medication' });
  }
});

router.put('/:id', async (req: any, res: any) => {
  try {
    const existing = await db.getUserMedication(req.params.id, req.userId);
    if (!existing) return res.status(404).json({ error: 'Medication not found' });

    const { name, dosage, activeIngredient, form, instructions, prescribedBy, startDate, endDate, isActive, notes } = req.body;

    const medication = await db.updateUserMedication(req.params.id, {
      name,
      dosage,
      activeIngredient,
      form,
      instructions,
      prescribedBy,
      startDate,
      endDate,
      isActive,
      notes,
    });

    res.json({ medication });
  } catch (error) {
    console.error('Update medication error:', error);
    res.status(500).json({ error: 'Failed to update medication' });
  }
});

router.delete('/:id', async (req: any, res: any) => {
  try {
    const existing = await db.getUserMedication(req.params.id, req.userId);
    if (!existing) return res.status(404).json({ error: 'Medication not found' });
    await db.deleteUserMedication(req.params.id);
    res.json({ message: 'Medication deleted successfully' });
  } catch (error) {
    console.error('Delete medication error:', error);
    res.status(500).json({ error: 'Failed to delete medication' });
  }
});

export default router;
