import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User.js";
import { Truck } from "../models/Truck.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "nextmile-secret-key-change-in-production";

export interface AuthRequest extends Request {
  user?: IUser;
}

export function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
    };

    const user = await User.findById(decoded.userId).select("-password");

    if (!user || !user.active) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.user = user;

    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

export function requireManagerOrAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || !["admin", "manager"].includes(req.user.role)) {
    res.status(403).json({
      error: "Manager or admin access required",
    });
    return;
  }

  next();
}

export function getUserCompanyName(req: AuthRequest): string {
  return String(req.user?.companyName || "").trim();
}

export function canAccessCompany(
  req: AuthRequest,
  companyName: string | null | undefined,
): boolean {
  if (!req.user) {
    return false;
  }

  // Admin can access every company.
  if (req.user.role === "admin") {
    return true;
  }

  const userCompany = String(req.user.companyName || "")
    .trim()
    .toLowerCase();

  const targetCompany = String(companyName || "")
    .trim()
    .toLowerCase();

  if (!userCompany || !targetCompany) {
    return false;
  }

  return userCompany === targetCompany;
}

export async function canAccessTruck(
  req: AuthRequest,
  truckId: string,
): Promise<boolean> {
  if (!req.user) {
    return false;
  }

  // Admin: all trucks.
  if (req.user.role === "admin") {
    return true;
  }

  // Manager: all trucks belonging to their company.
  if (req.user.role === "manager") {
    const truck = await Truck.findById(truckId).select("companyName");

    if (!truck) {
      return false;
    }

    return canAccessCompany(req, truck.companyName);
  }

  // Employee: assigned truck only.
  if (req.user.role === "employee") {
    if (!req.user.truck) {
      return false;
    }

    return String(req.user.truck) === String(truckId);
  }

  return false;
}
