import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Truck } from "../models/Truck.js";
import { Trip } from "../models/Trip.js";
import { Expense } from "../models/Expense.js";
import {
  weekLabelForDate,
  calculateTripFields,
} from "../utils/calculations.js";

async function seed() {
  await connectDB();
  console.log("🌱 Seeding database with rich data...");

  // Clear existing data
  await Truck.deleteMany({});
  await Trip.deleteMany({});
  await Expense.deleteMany({});

  // Create 5 trucks
  const trucks = await Truck.insertMany([
    {
      truckName: "AAA 1234",
      status: "Active",
      notes: "Primary hauler - Batangas route",
      cutoffStart: 1,
      cutoffEnd: 6,
      payday: 6,
      dayOff: 0,
    },
    {
      truckName: "BBB 5678",
      status: "Active",
      notes: "Secondary hauler - Laguna route",
      cutoffStart: 1,
      cutoffEnd: 6,
      payday: 6,
      dayOff: 0,
    },
    {
      truckName: "CCC 9012",
      status: "Active",
      notes: "Express hauler - Manila route",
      cutoffStart: 1,
      cutoffEnd: 6,
      payday: 6,
      dayOff: 0,
    },
    {
      truckName: "DDD 3456",
      status: "Inactive",
      notes: "Under major maintenance - engine rebuild",
      cutoffStart: 1,
      cutoffEnd: 6,
      payday: 6,
      dayOff: 0,
    },
    {
      truckName: "EEE 7890",
      status: "Active",
      notes: "New unit - Cavite route",
      cutoffStart: 1,
      cutoffEnd: 6,
      payday: 6,
      dayOff: 0,
    },
  ]);

  console.log(`✅ ${trucks.length} trucks created`);

  const shipmentPrefixes = ["SHP", "DEL", "HAU", "TRK"];
  const rates = [
    3500, 4000, 4200, 4500, 4800, 5000, 5200, 5500, 5800, 6000, 6500, 7000,
  ];
  const now = new Date();

  // Generate trips for 120 days for active trucks
  const tripData: any[] = [];
  const activeTrucks = trucks.filter((t) => t.status === "Active");

  for (let i = 120; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(12, 0, 0, 0);
    const isSunday = date.getDay() === 0;
    const dayNum = String(date.getDate()).padStart(2, "0");
    const monthNum = String(date.getMonth() + 1).padStart(2, "0");

    for (const truck of activeTrucks) {
      // Skip some days randomly for non-primary trucks
      if (truck.truckName !== "AAA 1234" && Math.random() > 0.7) continue;

      if (isSunday) {
        // Day off for all trucks on Sunday
        tripData.push({
          truck: truck._id,
          date: new Date(date),
          week: weekLabelForDate(date),
          status: "Day Off",
          shipmentNumber: "",
          rate: 0,
          trips: 0,
          crewSalary: 0,
          cashAdvance: 0,
          reimbursements: 0,
          paid: false,
          note: "",
          expenses: 0,
          grossIncome: 0,
          netIncome: 0,
          payable: 0,
        });
        continue;
      }

      // Add holidays on specific dates
      const isHoliday = date.getMonth() === 3 && date.getDate() === 9; // Apr 9
      if (isHoliday) {
        tripData.push({
          truck: truck._id,
          date: new Date(date),
          week: weekLabelForDate(date),
          status: "Holiday",
          shipmentNumber: "",
          rate: 0,
          trips: 0,
          crewSalary: 0,
          cashAdvance: 0,
          reimbursements: 0,
          paid: false,
          note: "Araw ng Kagitingan",
          expenses: 0,
          grossIncome: 0,
          netIncome: 0,
          payable: 0,
        });
        continue;
      }

      const rate = rates[Math.floor(Math.random() * rates.length)];
      const tripCount = Math.random() > 0.85 ? 2 : 1;
      const prefix =
        shipmentPrefixes[Math.floor(Math.random() * shipmentPrefixes.length)];
      const shipment = `${prefix}-${monthNum}${dayNum}-${Math.floor(Math.random() * 900 + 100)}`;
      const crewSalary = 1900;
      const cashAdvance =
        Math.random() > 0.75 ? Math.floor(Math.random() * 3 + 1) * 200 : 0;
      const reimbursements =
        Math.random() > 0.85 ? Math.floor(Math.random() * 4 + 1) * 100 : 0;
      const paid = Math.random() > 0.35;

      const computed = calculateTripFields({
        rate,
        trips: tripCount,
        crewSalary,
        cashAdvance,
        reimbursements,
        expenses: 0,
        paid,
      });

      tripData.push({
        truck: truck._id,
        date: new Date(date),
        week: weekLabelForDate(date),
        status: "Working Day",
        shipmentNumber: shipment,
        rate,
        trips: tripCount,
        crewSalary,
        cashAdvance,
        reimbursements,
        paid,
        note: "",
        expenses: 0,
        grossIncome: computed.grossIncome,
        netIncome: computed.netIncome,
        payable: computed.payable,
      });

      // Some days have 2 trips (2nd shipment)
      if (Math.random() > 0.9) {
        const rate2 = rates[Math.floor(Math.random() * rates.length)];
        const shipment2 = `${prefix}-${monthNum}${dayNum}-${Math.floor(Math.random() * 900 + 100)}B`;
        const computed2 = calculateTripFields({
          rate: rate2,
          trips: 1,
          crewSalary: 1900,
          cashAdvance: 0,
          reimbursements: 0,
          expenses: 0,
          paid: false,
        });
        tripData.push({
          truck: truck._id,
          date: new Date(date),
          week: weekLabelForDate(date),
          status: "Working Day",
          shipmentNumber: shipment2,
          rate: rate2,
          trips: 1,
          crewSalary: 1900,
          cashAdvance: 0,
          reimbursements: 0,
          paid: false,
          note: "Additional trip",
          expenses: 0,
          grossIncome: computed2.grossIncome,
          netIncome: computed2.netIncome,
          payable: computed2.payable,
        });
      }
    }
  }

  await Trip.insertMany(tripData);
  console.log(`✅ ${tripData.length} trips created`);

  // Create rich expense data with multiple items per date
  const expenseTemplates = [
    {
      category: "Fuel",
      descriptions: [
        "Diesel @ 62/L - 50L",
        "Diesel @ 63/L - 40L",
        "Diesel @ 60/L - 45L",
        "Diesel fill-up Petron",
        "Diesel fill-up Shell",
      ],
      minAmt: 2500,
      maxAmt: 5000,
    },
    {
      category: "Maintenance",
      descriptions: [
        "Oil change",
        "Brake pads replacement",
        "Air filter replacement",
        "Engine tune-up",
        "Transmission fluid change",
        "ATF, 2x Coolant",
      ],
      minAmt: 800,
      maxAmt: 8000,
    },
    {
      category: "Toll",
      descriptions: [
        "SLEX toll",
        "NLEX toll",
        "Skyway toll",
        "TPLEX toll",
        "MCX toll",
      ],
      minAmt: 150,
      maxAmt: 800,
    },
    {
      category: "Tires",
      descriptions: [
        "Front left tire replacement",
        "Rear tire rotation",
        "Spare tire",
        "Full tire set replacement",
        "Tire vulcanizing",
      ],
      minAmt: 2000,
      maxAmt: 15000,
    },
    {
      category: "Parts",
      descriptions: [
        "Fan belt",
        "Radiator cap",
        "Brake fluid",
        "Wiper blades",
        "Side mirror replacement",
        "Headlight bulb",
      ],
      minAmt: 200,
      maxAmt: 5000,
    },
    {
      category: "Oil Change",
      descriptions: [
        "Full synthetic oil",
        "Semi-synthetic oil",
        "Engine oil + filter",
        "Gear oil change",
      ],
      minAmt: 1500,
      maxAmt: 3500,
    },
    {
      category: "Registration",
      descriptions: [
        "Annual registration",
        "Franchise renewal",
        "LTO registration",
        "Emission test",
      ],
      minAmt: 2000,
      maxAmt: 8000,
    },
    {
      category: "Parking",
      descriptions: [
        "Overnight parking",
        "Terminal parking fee",
        "Loading bay fee",
      ],
      minAmt: 100,
      maxAmt: 500,
    },
    {
      category: "Miscellaneous",
      descriptions: [
        "Car wash",
        "Lona (tarpaulin)",
        "Rope/tie-down straps",
        "Reflective stickers",
      ],
      minAmt: 200,
      maxAmt: 2000,
    },
  ];

  const expenseData: any[] = [];

  for (const truck of activeTrucks) {
    for (let i = 100; i >= 0; i -= Math.floor(Math.random() * 3 + 1)) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(12, 0, 0, 0);

      if (date.getDay() === 0) continue; // Skip Sunday

      // Add 1-3 expense items per date
      const numExpenses =
        Math.random() > 0.7 ? (Math.random() > 0.5 ? 3 : 2) : 1;

      const usedCategories = new Set<string>();
      for (let j = 0; j < numExpenses; j++) {
        let template;
        do {
          template =
            expenseTemplates[
              Math.floor(Math.random() * expenseTemplates.length)
            ];
        } while (
          usedCategories.has(template.category) &&
          usedCategories.size < expenseTemplates.length
        );

        usedCategories.add(template.category);
        const desc =
          template.descriptions[
            Math.floor(Math.random() * template.descriptions.length)
          ];
        const amount = Math.floor(
          Math.random() * (template.maxAmt - template.minAmt) + template.minAmt,
        );

        expenseData.push({
          truck: truck._id,
          date: new Date(date),
          category: template.category,
          amount,
          description: desc,
        });
      }
    }
  }

  await Expense.insertMany(expenseData);
  console.log(`✅ ${expenseData.length} expenses created`);

  // Sync expenses into trips
  console.log("⏳ Syncing expenses to trips...");
  const uniqueDates = new Map<string, { truckId: string; date: Date }>();

  for (const exp of expenseData) {
    const key = `${exp.truck.toString()}_${exp.date.toISOString().slice(0, 10)}`;
    if (!uniqueDates.has(key)) {
      uniqueDates.set(key, { truckId: exp.truck.toString(), date: exp.date });
    }
  }

  let syncCount = 0;
  for (const { truckId, date } of uniqueDates.values()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dayExpenses = await Expense.find({
      truck: truckId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });
    const total = dayExpenses.reduce(
      (sum: number, e: any) => sum + e.amount,
      0,
    );

    const firstTrip = await Trip.findOne({
      truck: truckId,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ createdAt: 1 });

    if (firstTrip) {
      const computed = calculateTripFields({
        rate: firstTrip.rate,
        trips: firstTrip.trips,
        crewSalary: firstTrip.crewSalary,
        cashAdvance: firstTrip.cashAdvance,
        reimbursements: firstTrip.reimbursements,
        expenses: total,
        paid: firstTrip.paid,
      });

      await Trip.findByIdAndUpdate(firstTrip._id, {
        expenses: total,
        grossIncome: computed.grossIncome,
        netIncome: computed.netIncome,
        payable: computed.payable,
      });
      syncCount++;
    }
  }

  console.log(`✅ ${syncCount} trip-expense syncs completed`);
  console.log("🎉 Seed complete!");
  console.log(`   📦 ${trucks.length} trucks`);
  console.log(`   🚛 ${tripData.length} trips`);
  console.log(`   💰 ${expenseData.length} expenses`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
