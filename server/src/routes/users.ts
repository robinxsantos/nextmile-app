import { Router, Response } from 'express';
import { User } from '../models/User.js';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// All user routes require admin
router.use(requireAuth, requireAdmin);

// GET /api/users
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('truck', 'truckName')
      .sort({ createdAt: -1 });

    const rows = users.map((u) => ({
      _id: u._id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      truck: u.truck,
      truckName: (u.truck as any)?.truckName || '',
      active: u.active,
      createdAt: u.createdAt,
    }));

    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, displayName, role, truck } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }
    if (!displayName) {
      res.status(400).json({ error: 'Display name is required' });
      return;
    }

    const existing = await User.findOne({ username: username.toLowerCase().trim() });
    if (existing) {
      res.status(400).json({ error: 'Username already exists' });
      return;
    }

    const user = await User.create({
      username: username.toLowerCase().trim(),
      password,
      displayName: displayName.trim(),
      role: role || 'employee',
      truck: truck || null,
      active: true,
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      truck: user.truck,
      active: user.active,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, role, truck, active, password } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (displayName) user.displayName = displayName.trim();
    if (role && ['admin', 'employee'].includes(role)) user.role = role;
    if (truck !== undefined) user.truck = truck || null;
    if (active !== undefined) user.active = active;
    if (password) user.password = password; // will be hashed by pre-save hook

    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      truck: user.truck,
      active: user.active,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Don't allow deleting yourself
    if (String(user._id) === String(req.user!._id)) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
