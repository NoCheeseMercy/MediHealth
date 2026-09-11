import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../services/appwriteDb.service';

const router = Router();

router.use(authenticate);

router.get('/', async (req: any, res: any) => {
  try {
    const reminders = await db.getReminders(req.userId);
    const active = (reminders as any[]).filter((r: any) => r.isActive !== false);

    const enriched = await Promise.all(
      active.map(async (r: any) => {
        const medication = r.medicationId
          ? await db.getUserMedication(r.medicationId, req.userId)
          : null;
        const completions = await db.getReminderCompletions(r.$id);
        return {
          ...r,
          id: r.$id,
          medication: medication
            ? { id: medication.$id, name: (medication as any).name, dosage: (medication as any).dosage }
            : null,
          completions: completions.slice(0, 1),
        };
      })
    );

    res.json({ reminders: enriched });
  } catch (error) {
    console.error('Fetch reminders error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

router.get('/medication/:medicationId', async (req: any, res: any) => {
  try {
    const medication = await db.getUserMedication(req.params.medicationId, req.userId);
    if (!medication) return res.status(404).json({ error: 'Medication not found' });

    const allReminders = await db.getReminders(req.userId);
    const reminders = (allReminders as any[]).filter((r: any) => r.medicationId === req.params.medicationId);

    res.json({ reminders });
  } catch (error) {
    console.error('Fetch reminders error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

router.post('/', async (req: any, res: any) => {
  try {
    const { medicationId, time, frequency, daysOfWeek } = req.body;

    if (!medicationId || !time) {
      return res.status(400).json({ error: 'Medication ID and time are required' });
    }

    const medication = await db.getUserMedication(medicationId, req.userId);
    if (!medication) return res.status(404).json({ error: 'Medication not found' });

    const serializedDays = daysOfWeek ? JSON.stringify(daysOfWeek) : '[]';
    const reminder = await db.createReminder(req.userId, {
      medicationId,
      medicationName: (medication as any).name,
      time,
      frequency: frequency || 'daily',
      daysOfWeek: serializedDays,
      days: serializedDays,
      enabled: true,
      isActive: true,
    });

    res.status(201).json({ reminder: { ...reminder, id: reminder.$id } });
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

router.patch('/:id', async (req: any, res: any) => {
  try {
    const reminder = await db.getReminder(req.params.id, req.userId);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    const { isActive, time, frequency, daysOfWeek } = req.body;
    const serializedDays = daysOfWeek ? JSON.stringify(daysOfWeek) : undefined;
    const updated = await db.updateReminder(req.params.id, {
      ...(isActive !== undefined && { isActive, enabled: isActive }),
      ...(time && { time }),
      ...(frequency && { frequency }),
      ...(serializedDays && { daysOfWeek: serializedDays, days: serializedDays }),
    });

    res.json({ reminder: { ...updated, id: updated.$id } });
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

router.delete('/:id', async (req: any, res: any) => {
  try {
    const reminder = await db.getReminder(req.params.id, req.userId);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    await db.deleteReminder(req.params.id);
    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

router.post('/:id/complete', async (req: any, res: any) => {
  try {
    const reminder = await db.getReminder(req.params.id, req.userId);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    const completion = await db.createReminderCompletion({
      reminderId: req.params.id,
      status: req.body.status || 'taken',
      completedAt: new Date().toISOString(),
    });

    res.status(201).json({ completion: { ...completion, id: completion.$id } });
  } catch (error) {
    console.error('Complete reminder error:', error);
    res.status(500).json({ error: 'Failed to mark reminder as complete' });
  }
});

export default router;
