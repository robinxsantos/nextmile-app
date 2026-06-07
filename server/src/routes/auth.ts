import { Router, Response } from "express";
import { User } from "../models/User.js";
import {
  generateToken,
  requireAuth,
  type AuthRequest,
} from "../middleware/auth.js";

const router = Router();

export async function ensureDefaultAdmin() {
  const count = await User.countDocuments();

  if (count > 0) {
    return { created: false };
  }

  const admin = await User.create({
    username: "admin",
    password: "admin123",
    displayName: "Robin Santos",
    role: "admin",
    active: true,
  });

  return {
    created: true,
    username: admin.username,
    password: "admin123",
  };
}

// POST /api/auth/login
router.post("/login", async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const user = await User.findOne({
      username: username.toLowerCase().trim(),
    });
    if (!user || !user.active) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken(String(user._id), user.role);

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        truck: user.truck,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!._id)
      .select("-password")
      .populate("truck", "truckName");

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        truck: user.truck,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile - update own display name
router.put("/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName } = req.body;
    if (!displayName?.trim()) {
      res.status(400).json({ error: "Display name is required" });
      return;
    }

    await User.findByIdAndUpdate(req.user!._id, {
      displayName: displayName.trim(),
    });
    const updated = await User.findById(req.user!._id).select("-password");

    res.json({
      user: {
        _id: updated!._id,
        username: updated!.username,
        displayName: updated!.displayName,
        role: updated!.role,
        truck: updated!.truck,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/password - change own password
router.put(
  "/password",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res
          .status(400)
          .json({ error: "Current and new passwords are required" });
        return;
      }
      if (newPassword.length < 4) {
        res
          .status(400)
          .json({ error: "New password must be at least 4 characters" });
        return;
      }

      const user = await User.findById(req.user!._id);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }

      user.password = newPassword;
      await user.save();

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
