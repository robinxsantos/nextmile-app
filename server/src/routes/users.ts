import { Router, Response } from "express";

import { User } from "../models/User.js";
import { Truck } from "../models/Truck.js";
import { Company } from "../models/Company.js";

import {
  requireAuth,
  requireManagerOrAdmin,
  type AuthRequest,
} from "../middleware/auth.js";

const router = Router();

// Admin + Manager only.
// Employees cannot access user management.
router.use(requireAuth, requireManagerOrAdmin);

// GET /api/users
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const filter: Record<string, any> = {};

    if (req.user?.role === "manager") {
      const companyName = String(req.user.companyName || "").trim();

      if (!companyName) {
        res.json({ rows: [] });
        return;
      }

      // Manager can see Managers and Employees
      // belonging to their own company.
      filter.role = {
        $in: ["manager", "employee"],
      };

      filter.companyName = companyName;
    }

    const users = await User.find(filter)
      .select("-password")
      .populate("truck", "truckName companyName")
      .sort({ createdAt: -1 });

    const rows = users.map((u) => ({
      _id: u._id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      companyName: u.companyName || "",
      truck: u.truck,
      truckName: (u.truck as any)?.truckName || "",
      licenseNumber: u.licenseNumber || "",
      startDate: u.startDate || null,
      active: u.active,
      createdAt: u.createdAt,
    }));

    res.json({ rows });
  } catch (err: any) {
    console.error("Error loading users:", err);

    res.status(500).json({
      error: err.message || "Failed to load users",
    });
  }
});

// POST /api/users
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      username,
      password,
      displayName,
      role,
      truck,
      companyName,
      licenseNumber,
      startDate,
    } = req.body;

    if (!username || !password) {
      res.status(400).json({
        error: "Username and password are required",
      });
      return;
    }

    if (!displayName) {
      res.status(400).json({
        error: "Display name is required",
      });
      return;
    }

    const cleanUsername = String(username).toLowerCase().trim();
    const cleanDisplayName = String(displayName).trim();

    const existing = await User.findOne({
      username: cleanUsername,
    });

    if (existing) {
      res.status(400).json({
        error: "Username already exists",
      });
      return;
    }

    const requestedRole =
      role === "admin" || role === "manager" || role === "employee"
        ? role
        : "employee";

    // Managers can create Manager or Employee accounts,
    // but never Admin accounts.
    if (req.user?.role === "manager" && requestedRole === "admin") {
      res.status(403).json({
        error: "Managers cannot create admin accounts",
      });
      return;
    }

    let finalCompanyName = "";
    let finalTruck = null;
    let finalLicenseNumber = "";
    let finalStartDate: Date | null = null;

    // Manager and Employee accounts require a start date.
    if (requestedRole !== "admin") {
      if (!startDate) {
        res.status(400).json({
          error: "Start date is required",
        });
        return;
      }

      const parsedStartDate = new Date(startDate);

      if (Number.isNaN(parsedStartDate.getTime())) {
        res.status(400).json({
          error: "Invalid start date",
        });
        return;
      }

      // Keep date stable regardless of timezone.
      parsedStartDate.setHours(12, 0, 0, 0);

      finalStartDate = parsedStartDate;
    }

    // MANAGER ACCOUNT
    if (requestedRole === "manager") {
      finalLicenseNumber = "";
      if (req.user?.role === "manager") {
        // Manager-created Manager automatically inherits
        // the logged-in Manager's company.
        finalCompanyName = String(req.user.companyName || "").trim();
      } else {
        // Admin chooses the company.
        finalCompanyName = String(companyName || "").trim();
      }

      if (!finalCompanyName) {
        res.status(400).json({
          error: "Company is required for manager accounts",
        });
        return;
      }

      const company = await Company.findOne({
        companyName: finalCompanyName,
      });

      if (!company) {
        res.status(400).json({
          error: "Selected company does not exist",
        });
        return;
      }

      if (company.status !== "Active") {
        res.status(400).json({
          error: "Selected company is inactive",
        });
        return;
      }

      // Always use the canonical company name.
      finalCompanyName = company.companyName;

      // Managers are company-scoped, not truck-scoped.
      finalTruck = null;
    }

    // EMPLOYEE ACCOUNT
    if (requestedRole === "employee") {
      finalLicenseNumber = String(licenseNumber || "").trim();

      if (!finalLicenseNumber) {
        res.status(400).json({
          error: "License number is required for driver accounts",
        });
        return;
      }

      if (!truck) {
        res.status(400).json({
          error: "Truck is required for employee accounts",
        });
        return;
      }

      const selectedTruck = await Truck.findById(truck).select(
        "truckName companyName",
      );

      if (!selectedTruck) {
        res.status(404).json({
          error: "Selected truck not found",
        });
        return;
      }

      const truckCompanyName = String(selectedTruck.companyName || "").trim();

      if (!truckCompanyName) {
        res.status(400).json({
          error: "Selected truck does not have a company assigned",
        });
        return;
      }

      // Manager can assign only trucks under their own company.
      if (req.user?.role === "manager") {
        const managerCompanyName = String(req.user.companyName || "").trim();

        if (
          !managerCompanyName ||
          managerCompanyName.toLowerCase() !== truckCompanyName.toLowerCase()
        ) {
          res.status(403).json({
            error: "You can only assign employees to trucks under your company",
          });
          return;
        }

        // Always use the Manager's canonical company value.
        finalCompanyName = managerCompanyName;
      } else {
        // Admin-created employee inherits company from selected truck.
        finalCompanyName = truckCompanyName;
      }

      finalTruck = selectedTruck._id;
    }

    // ADMIN ACCOUNT
    if (requestedRole === "admin") {
      finalLicenseNumber = "";
      finalStartDate = null;
      if (req.user?.role !== "admin") {
        res.status(403).json({
          error: "Only admins can create admin accounts",
        });
        return;
      }

      finalCompanyName = "";
      finalTruck = null;
    }

    const user = await User.create({
      username: cleanUsername,
      password,
      displayName: cleanDisplayName,
      role: requestedRole,
      companyName: finalCompanyName,
      truck: finalTruck,
      licenseNumber: finalLicenseNumber,
      startDate: finalStartDate,
      active: true,
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      companyName: user.companyName || "",
      truck: user.truck,
      licenseNumber: user.licenseNumber || "",
      startDate: user.startDate || null,
      active: user.active,
    });
  } catch (err: any) {
    console.error("Error creating user:", err);

    res.status(500).json({
      error: err.message || "Failed to create user",
    });
  }
});

// PUT /api/users/:id
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const {
      displayName,
      role,
      truck,
      active,
      password,
      companyName,
      licenseNumber,
      startDate,
    } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({
        error: "User not found",
      });
      return;
    }

    const isAdmin = req.user?.role === "admin";
    const isManager = req.user?.role === "manager";
    const isSelf = String(user._id) === String(req.user?._id);

    // Manager permissions.
    if (isManager) {
      const managerCompanyName = String(req.user?.companyName || "").trim();

      // Manager may manage Manager or Employee accounts
      // belonging to their own company.
      if (!isSelf) {
        if (!["manager", "employee"].includes(user.role)) {
          res.status(403).json({
            error: "Managers can only manage manager or employee accounts",
          });
          return;
        }

        if (
          String(user.companyName || "")
            .trim()
            .toLowerCase() !== managerCompanyName.toLowerCase()
        ) {
          res.status(403).json({
            error: "You cannot manage users from another company",
          });
          return;
        }
      }

      // Manager may switch users between Manager and Employee,
      // but can never promote anyone to Admin.
      if (
        role &&
        role !== user.role &&
        !["manager", "employee"].includes(role)
      ) {
        res.status(403).json({
          error: "Managers cannot assign the admin role",
        });
        return;
      }

      // Manager cannot change company directly.
      if (
        companyName !== undefined &&
        String(companyName || "")
          .trim()
          .toLowerCase() !==
          String(user.companyName || "")
            .trim()
            .toLowerCase()
      ) {
        res.status(403).json({
          error: "Managers cannot change user company",
        });
        return;
      }

      // Manager cannot assign themselves to a truck.
      if (isSelf && truck !== undefined && truck) {
        res.status(403).json({
          error: "Manager accounts are company-based, not truck-based",
        });
        return;
      }
    }

    if (displayName) {
      user.displayName = String(displayName).trim();
    }

    // Admin can assign any valid role.
    // Manager can switch users within Manager/Employee only.
    if (
      role &&
      ((isAdmin && ["admin", "manager", "employee"].includes(role)) ||
        (isManager && ["manager", "employee"].includes(role)))
    ) {
      user.role = role;
    }

    // Start date is required for Manager and Employee accounts.
    if (user.role !== "admin") {
      if (!startDate) {
        res.status(400).json({
          error: "Start date is required",
        });
        return;
      }

      const parsedStartDate = new Date(startDate);

      if (Number.isNaN(parsedStartDate.getTime())) {
        res.status(400).json({
          error: "Invalid start date",
        });
        return;
      }

      parsedStartDate.setHours(12, 0, 0, 0);

      user.startDate = parsedStartDate;
    }

    // Handle Manager company assignment.
    if ((isAdmin || isManager) && user.role === "manager") {
      const nextCompanyName = isManager
        ? String(req.user?.companyName || "").trim()
        : String(
            companyName !== undefined ? companyName : user.companyName || "",
          ).trim();

      if (!nextCompanyName) {
        res.status(400).json({
          error: "Company is required for manager accounts",
        });
        return;
      }

      const company = await Company.findOne({
        companyName: nextCompanyName,
      });

      if (!company) {
        res.status(400).json({
          error: "Selected company does not exist",
        });
        return;
      }

      const companyChanged =
        String(user.companyName || "")
          .trim()
          .toLowerCase() !== company.companyName.trim().toLowerCase();

      if (companyChanged && company.status !== "Active") {
        res.status(400).json({
          error: "Cannot assign a manager to an inactive company",
        });
        return;
      }

      user.companyName = company.companyName;
      user.truck = undefined;
      user.licenseNumber = "";
    }

    // Driver accounts require a license number.
    if (user.role === "employee") {
      const nextLicenseNumber = String(licenseNumber || "").trim();

      if (!nextLicenseNumber) {
        res.status(400).json({
          error: "License number is required for driver accounts",
        });
        return;
      }

      user.licenseNumber = nextLicenseNumber;
    }

    // Handle Employee truck assignment.
    if (user.role === "employee" && truck !== undefined) {
      if (!truck) {
        res.status(400).json({
          error: "Truck is required for employee accounts",
        });
        return;
      }

      const selectedTruck = await Truck.findById(truck).select(
        "truckName companyName",
      );

      if (!selectedTruck) {
        res.status(404).json({
          error: "Selected truck not found",
        });
        return;
      }

      const truckCompanyName = String(selectedTruck.companyName || "").trim();

      if (!truckCompanyName) {
        res.status(400).json({
          error: "Selected truck does not have a company assigned",
        });
        return;
      }

      if (isManager) {
        const managerCompanyName = String(req.user?.companyName || "").trim();

        if (
          managerCompanyName.toLowerCase() !== truckCompanyName.toLowerCase()
        ) {
          res.status(403).json({
            error: "You can only assign employees to trucks under your company",
          });
          return;
        }

        user.companyName = managerCompanyName;
      } else {
        user.companyName = truckCompanyName;
      }

      user.truck = selectedTruck._id;
    }

    // Admin account has no company/truck scope.
    if (user.role === "admin") {
      user.companyName = "";
      user.truck = undefined;
      user.licenseNumber = "";
      user.startDate = null;
    }

    if (active !== undefined) {
      // Manager cannot deactivate themselves.
      if (isManager && isSelf && active === false) {
        res.status(400).json({
          error: "You cannot deactivate your own account",
        });
        return;
      }

      user.active = Boolean(active);
    }

    if (password) {
      user.password = password;
    }

    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      companyName: user.companyName || "",
      truck: user.truck,
      licenseNumber: user.licenseNumber || "",
      startDate: user.startDate || null,
      active: user.active,
    });
  } catch (err: any) {
    console.error("Error updating user:", err);

    res.status(500).json({
      error: err.message || "Failed to update user",
    });
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({
        error: "User not found",
      });
      return;
    }

    // Nobody can delete themselves.
    if (String(user._id) === String(req.user?._id)) {
      res.status(400).json({
        error: "Cannot delete your own account",
      });
      return;
    }

    // Manager may delete Manager or Employee accounts
    // belonging to their own company.
    if (req.user?.role === "manager") {
      if (!["manager", "employee"].includes(user.role)) {
        res.status(403).json({
          error: "Managers can only delete manager or employee accounts",
        });
        return;
      }

      const managerCompanyName = String(req.user.companyName || "")
        .trim()
        .toLowerCase();

      const userCompanyName = String(user.companyName || "")
        .trim()
        .toLowerCase();

      if (!managerCompanyName || managerCompanyName !== userCompanyName) {
        res.status(403).json({
          error: "You cannot delete users from another company",
        });
        return;
      }
    }

    await User.findByIdAndDelete(user._id);

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Error deleting user:", err);

    res.status(500).json({
      error: err.message || "Failed to delete user",
    });
  }
});

export default router;
