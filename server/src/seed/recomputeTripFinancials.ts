import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import { Trip } from "../models/Trip.js";
import { syncTripsForDate } from "../services/tripService.js";

dotenv.config({ path: ".env" });

async function run() {
  try {
    console.log("MONGODB_URI loaded:", process.env.MONGODB_URI ? "YES" : "NO");
    await connectDB();

    console.log("Recomputing trip financials...");

    const trips = await Trip.find({}).select("truck date");

    const uniqueDates = new Map<
      string,
      {
        truckId: any;
        date: Date;
      }
    >();

    for (const trip of trips) {
      const date = new Date(trip.date);

      const dateKey = [
        String(trip.truck),
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ].join("-");

      if (!uniqueDates.has(dateKey)) {
        uniqueDates.set(dateKey, {
          truckId: trip.truck,
          date,
        });
      }
    }

    console.log(`Found ${uniqueDates.size} truck/date combinations.`);

    let processed = 0;

    for (const { truckId, date } of uniqueDates.values()) {
      await syncTripsForDate(truckId, date);

      processed++;

      if (processed % 50 === 0) {
        console.log(`Processed ${processed}/${uniqueDates.size}`);
      }
    }

    console.log(`Done. Recomputed ${processed} truck/date combinations.`);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
