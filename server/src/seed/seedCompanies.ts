import "dotenv/config";
import { connectDB } from "../config/db.js";
import { Truck } from "../models/Truck.js";
import { Company } from "../models/Company.js";

async function seedCompanies() {
  try {
    await connectDB();

    const companyNames = await Truck.distinct("companyName");

    const cleanedNames = companyNames
      .map((name) => String(name || "").trim())
      .filter(Boolean);

    let created = 0;
    let existing = 0;

    for (const companyName of cleanedNames) {
      const found = await Company.findOne({
        companyName: {
          $regex: new RegExp(
            `^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i",
          ),
        },
      });

      if (found) {
        existing++;
        continue;
      }

      await Company.create({
        companyName,
        status: "Active",
      });

      created++;
    }

    console.log("");
    console.log("Company seed complete.");
    console.log(`Created: ${created}`);
    console.log(`Already existing: ${existing}`);
    console.log(`Total found from trucks: ${cleanedNames.length}`);

    process.exit(0);
  } catch (err) {
    console.error("Failed to seed companies:", err);
    process.exit(1);
  }
}

seedCompanies();
