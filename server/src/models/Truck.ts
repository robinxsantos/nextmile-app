import mongoose, { Schema, Document } from "mongoose";

export interface ITruck extends Document {
  truckName: string;
  status: "Active" | "Inactive";
  cutoffType: "weekly" | "monthly";
  client: string;
  lastChangeOil: number | null;
  notes: string;
  cutoffStart: number;
  cutoffEnd: number;
  payday: number;
  dayOff: number;
  createdAt: Date;
  updatedAt: Date;
}

const TruckSchema = new Schema(
  {
    truckName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    cutoffType: {
      type: String,
      enum: ["weekly", "monthly"],
      default: "weekly",
    },
    client: {
      type: String,
      default: "",
      trim: true,
    },
    lastChangeOil: {
      type: Number,
      default: null,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
    },
    cutoffStart: {
      type: Number,
      min: 0,
      max: 31,
      default: 1,
    },
    cutoffEnd: {
      type: Number,
      min: 0,
      max: 31,
      default: 6,
    },
    payday: {
      type: Number,
      min: 0,
      max: 31,
      default: 6,
    },
    dayOff: {
      type: Number,
      min: 0,
      max: 6,
      default: 0,
    },
  },
  { timestamps: true },
);

export const Truck = mongoose.model("Truck", TruckSchema);
