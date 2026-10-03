import mongoose, { Schema, Document, Types } from "mongoose";

export interface IExpenseCategory extends Document {
  truck: Types.ObjectId;
  name: string;
  reimbursable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    truck: {
      type: Schema.Types.ObjectId,
      ref: "Truck",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    reimbursable: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

ExpenseCategorySchema.index(
  {
    truck: 1,
    name: 1,
  },
  {
    unique: true,
  },
);

export const ExpenseCategory = mongoose.model<IExpenseCategory>(
  "ExpenseCategory",
  ExpenseCategorySchema,
);
