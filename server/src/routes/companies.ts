import { Router, Response } from "express";
import mongoose from "mongoose";
import { Company } from "../models/Company.js";
import { Truck } from "../models/Truck.js";
import { User } from "../models/User.js";
import {
  requireAuth,
  requireAdmin,
  type AuthRequest,
} from "../middleware/auth.js";

const router = Router();

// All company management routes require authentication.
router.use(requireAuth);

// GET /api/companies
// Admin only for now because Companies page is Admin-only.
router.get("/", requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const companies = await Company.find().sort({
      companyName: 1,
    });

    const rows = companies.map((company) => ({
      _id: company._id,
      companyName: company.companyName,
      status: company.status,
      createdAt: company.createdAt,
    }));

    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({
      error: err.message || "Failed to load companies",
    });
  }
});

// POST /api/companies
router.post("/", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { companyName, status } = req.body;

    const cleanCompanyName = String(companyName || "").trim();

    if (!cleanCompanyName) {
      res.status(400).json({
        error: "Company name is required.",
      });
      return;
    }

    const existing = await Company.findOne({
      companyName: {
        $regex: new RegExp(
          `^${cleanCompanyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i",
        ),
      },
    });

    if (existing) {
      res.status(400).json({
        error: "Company already exists.",
      });
      return;
    }

    const company = await Company.create({
      companyName: cleanCompanyName,
      status: status === "Inactive" ? "Inactive" : "Active",
    });

    res.status(201).json(company);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || "Failed to create company",
    });
  }
});

// PUT /api/companies/:id
router.put("/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      res.status(404).json({
        error: "Company not found.",
      });
      return;
    }

    const { companyName, status } = req.body;

    const nextCompanyName = String(companyName ?? company.companyName).trim();

    if (!nextCompanyName) {
      res.status(400).json({
        error: "Company name is required.",
      });
      return;
    }

    const escapedCompanyName = nextCompanyName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    const duplicate = await Company.findOne({
      _id: { $ne: company._id },
      companyName: {
        $regex: new RegExp(`^${escapedCompanyName}$`, "i"),
      },
    });

    if (duplicate) {
      res.status(400).json({
        error: "Company already exists.",
      });
      return;
    }

    const nextStatus =
      status === "Active" || status === "Inactive" ? status : company.status;

    const oldCompanyName = company.companyName;

    const companyRenamed =
      oldCompanyName.trim().toLowerCase() !== nextCompanyName.toLowerCase();

    await session.withTransaction(async () => {
      if (companyRenamed) {
        await Truck.updateMany(
          {
            companyName: oldCompanyName,
          },
          {
            $set: {
              companyName: nextCompanyName,
            },
          },
          { session },
        );

        await User.updateMany(
          {
            companyName: oldCompanyName,
          },
          {
            $set: {
              companyName: nextCompanyName,
            },
          },
          { session },
        );
      }

      await Company.findByIdAndUpdate(
        company._id,
        {
          companyName: nextCompanyName,
          status: nextStatus,
        },
        {
          session,
        },
      );
    });

    const updatedCompany = await Company.findById(company._id);

    res.json(updatedCompany);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || "Failed to update company",
    });
  } finally {
    await session.endSession();
  }
});

// DELETE /api/companies/:id
router.delete("/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      res.status(404).json({
        error: "Company not found.",
      });
      return;
    }

    // Do not allow deleting a company still used by trucks or users.
    const [truckCount, userCount] = await Promise.all([
      Truck.countDocuments({
        companyName: company.companyName,
      }),
      User.countDocuments({
        companyName: company.companyName,
      }),
    ]);

    if (truckCount > 0 || userCount > 0) {
      res.status(400).json({
        error:
          "Cannot delete this company because it is still assigned to trucks or users.",
      });
      return;
    }

    await Company.findByIdAndDelete(company._id);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({
      error: err.message || "Failed to delete company",
    });
  }
});

export default router;
