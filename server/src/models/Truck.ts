import mongoose, { Schema, Document } from 'mongoose';

export interface ITruck extends Document {
  truckName: string;
  status: 'Active' | 'Inactive';
  notes: string;
  cutoffStart: number;
  cutoffEnd: number;
  payday: number;
  dayOff: number;
  createdAt: Date;
  updatedAt: Date;
}

const TruckSchema = new Schema<ITruck>(
  {
    truckName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    notes: {
      type: String,
      default: '',
    },
    cutoffStart: {
      type: Number,
      min: 0,
      max: 6,
      default: 1, // Monday
    },
    cutoffEnd: {
      type: Number,
      min: 0,
      max: 6,
      default: 6, // Saturday
    },
    payday: {
      type: Number,
      min: 0,
      max: 6,
      default: 6, // Saturday
    },
    dayOff: {
      type: Number,
      min: 0,
      max: 6,
      default: 0, // Sunday
    },
  },
  {
    timestamps: true,
  }
);

export const Truck = mongoose.model<ITruck>('Truck', TruckSchema);
