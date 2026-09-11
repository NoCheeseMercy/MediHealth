import 'dotenv/config';
import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import medicationRoutes from './routes/medications';
import analysisRoutes from './routes/analysis';
import reminderRoutes from './routes/reminders';
import scanRoutes from './routes/scan';
import profileRoutes from './routes/profile';
import healthRoutes from './routes/index';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

app.use('/api/health', healthRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', apiLimiter);

app.use('/api/medications', medicationRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/profile', profileRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

app.listen(PORT, () => {
  console.log(`🩺 MediHealth AI Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
