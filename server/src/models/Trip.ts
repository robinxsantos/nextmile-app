import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITrip extends Document {
  truck: Types.ObjectId;
  createdBy?: Types.ObjectId;
  date: Date;
  week: string;
  status: 'Working Day' | 'Day Off' | 'Holiday';
  shipmentNumber: string;
  rate: number;
  trips: number;
  crewSalary: number;
  cashAdvance: number;
  reimbursements: number;
  paid: boolean;
  note: string;
  grossIncome: number;
  netIncome: number;
  payable: number;
  expenses: number;
  createdAt: Date;
  updatedAt: Date;
}

const TripSchema = new Schema<ITrip>(
  {
    truck: {
      type: Schema.Types.ObjectId,
      ref: 'Truck',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    week: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Working Day', 'Day Off', 'Holiday'],
      default: 'Working Day',
    },
    shipmentNumber: {
      type: String,
      default: '',
      trim: true,
    },
    rate: {
      type: Number,
      default: 0,
    },
    trips: {
      type: Number,
      default: 0,
    },
    crewSalary: {
      type: Number,
      default: 0,
    },
    cashAdvance: {
      type: Number,
      default: 0,
    },
    reimbursements: {
      type: Number,
      default: 0,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    note: {
      type: String,
      default: '',
    },
    grossIncome: {
      type: Number,
      default: 0,
    },
    netIncome: {
      type: Number,
      default: 0,
    },
    payable: {
      type: Number,
      default: 0,
    },
    expenses: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
TripSchema.index({ truck: 1, date: 1 });

export const Trip = mongoose.model<ITrip>('Trip', TripSchema);
