import mongoose, { Schema, Document, Types } from "mongoose";

export interface IExpense extends Document {
  truck: Types.ObjectId;
  createdBy?: Types.ObjectId;
  date: Date;
  category: string;
  amount: number;
  description: string;
  reimbursed: boolean;
  createdAt: Date;
  updatedAt: Date;
  tripId?: Types.ObjectId;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    truck: {
      type: Schema.Types.ObjectId,
      ref: "Truck",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    tripId: {
      type: Schema.Types.ObjectId as unknown as Types.ObjectId,
      ref: "Trip",
      index: true,
    },
    reimbursed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

ExpenseSchema.index({ truck: 1, date: 1 });

export const Expense = mongoose.model<IExpense>("Expense", ExpenseSchema);
