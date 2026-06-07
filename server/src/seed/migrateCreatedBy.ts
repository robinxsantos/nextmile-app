import 'dotenv/config';
import mongoose from 'mongoose';
import { Trip } from '../models/Trip.js';
import { Expense } from '../models/Expense.js';
import { User } from '../models/User.js';

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  // Get all employee users with trucks
  const employees = await User.find({ role: 'employee', truck: { $ne: null } });
  console.log(`Found ${employees.length} employees with trucks`);

  // Migrate Trips
  console.log('\n--- Trips ---');
  for (const emp of employees) {
    const result = await Trip.updateMany(
      { truck: emp.truck, createdBy: null },
      { $set: { createdBy: emp._id } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Updated ${result.modifiedCount} trips for ${emp.displayName} (truck: ${emp.truck})`);
    }
  }

  const admin = await User.findOne({ role: 'admin' });
  if (admin) {
    const result = await Trip.updateMany(
      { createdBy: null },
      { $set: { createdBy: admin._id } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Updated ${result.modifiedCount} remaining trips assigned to admin`);
    }
  }

  // Migrate Expenses
  console.log('\n--- Expenses ---');
  for (const emp of employees) {
    const result = await Expense.updateMany(
      { truck: emp.truck, createdBy: null },
      { $set: { createdBy: emp._id } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Updated ${result.modifiedCount} expenses for ${emp.displayName} (truck: ${emp.truck})`);
    }
  }

  if (admin) {
    const result = await Expense.updateMany(
      { createdBy: null },
      { $set: { createdBy: admin._id } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Updated ${result.modifiedCount} remaining expenses assigned to admin`);
    }
  }

  await mongoose.disconnect();
  console.log('\nMigration complete!');
}

migrate().catch(console.error);
