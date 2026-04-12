import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import truckRoutes from './routes/trucks.js';
import tripRoutes from './routes/trips.js';
import expenseRoutes from './routes/expenses.js';
import dashboardRoutes from './routes/dashboard.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import paymentRoutes from './routes/payments.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
// Trucks: GET is for all users (employees need truck list for trip form), POST/PUT/DELETE are admin-protected inside the route
app.use('/api/trucks', requireAuth, truckRoutes);
app.use('/api/trips', requireAuth, tripRoutes);
// Expenses: by-date is allowed for all (note click), rest is admin-only (handled inside route)
app.use('/api/expenses', requireAuth, expenseRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/users', userRoutes); // already has its own auth middleware
app.use('/api/payments', paymentRoutes); // already has its own auth middleware

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 NEXTMILE API running on http://localhost:${PORT}`);
  });
}

start();
