import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../services/appwriteDb.service';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { validateAuthRequest } from '../middleware/validation';

const router = Router();

const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '30d') as jwt.SignOptions['expiresIn'],
  });
};

const publicUser = (profile: any) => ({
  id: profile.$id,
  email: profile.email,
  fullName: profile.fullName,
  preferredLanguage: profile.preferredLanguage,
});

router.post('/register', validateAuthRequest, async (req: any, res: any) => {
  try {
    const { email, password, fullName, preferredLanguage } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    const normalizedEmail = (email as string).trim().toLowerCase();
    const existing = await db.listUserProfiles(normalizedEmail);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password as string, 12);
    const profile = await db.createUserProfile({
      userId: crypto.randomUUID(),
      email: normalizedEmail,
      fullName: fullName as string,
      preferredLanguage: (preferredLanguage as string) || 'ar',
      passwordHash,
    });

    const token = generateToken((profile as any).$id);
    res.status(201).json({ user: publicUser(profile), token });
  } catch (error: any) {
    console.error('Register error:', error?.message || error);
    if (error.message?.includes('already exists') || error.code === 409) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = (email as string).trim().toLowerCase();
    const profiles = await db.listUserProfiles(normalizedEmail);
    const profile = profiles.find((p: any) => p.email === normalizedEmail);

    if (!profile || !(profile as any).passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password as string, (profile as any).passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken((profile as any).$id);
    res.json({ user: publicUser(profile), token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const profile = await db.getUserProfile(req.userId!);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: publicUser(profile) });
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

router.post('/change-password', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: 'Current password and a new password (8+ chars) are required' });
    }

    const profile = await db.getUserProfile(req.userId!);
    if (!profile || !(profile as any).passwordHash) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, (profile as any).passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.updateUserProfile(req.userId!, { passwordHash });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

router.post('/forgot-password', async (req: any, res: any) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = (email as string).trim().toLowerCase();
    const profiles = await db.listUserProfiles(normalizedEmail);
    const profile = profiles.find((p: any) => p.email === normalizedEmail);

    if (profile) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await db.upsertPasswordReset((profile as any).$id, code, expiresAt);
      console.log(`Password reset code for ${normalizedEmail}: ${code}`);
    }

    res.json({ message: 'If an account with this email exists, a reset code has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

router.post('/reset-password', async (req: any, res: any) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Valid code and new password (8+ chars) are required' });
    }

    const normalizedEmail = (email as string).trim().toLowerCase();
    const profiles = await db.listUserProfiles(normalizedEmail);
    const profile = profiles.find((p: any) => p.email === normalizedEmail);
    if (!profile) return res.status(400).json({ error: 'Invalid request' });

    const reset = await db.getPasswordReset((profile as any).$id);
    if (!reset || (reset as any).used || reset.code !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    if (new Date() > new Date((reset as any).expiresAt)) {
      return res.status(400).json({ error: 'Reset code has expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.updateUserProfile((profile as any).$id, { passwordHash });
    await db.markPasswordResetUsed((profile as any).$id);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

export default router;
