import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICollection extends Document {
  truck: Types.ObjectId;

  trips: Types.ObjectId[];

  createdBy: Types.ObjectId;

  collectionDate: Date;

  coverageStartDate?: Date;

  coverageEndDate?: Date;

  soaNumber: string;

  method: string;

  reference: string;

  billingType: "Rate Only" | "Rate + VAT";

  adjustments: {
    description: string;
    type: "Add" | "Less";
    amount: number;
  }[];

  totalAmount: number;

  note: string;

  createdAt: Date;

  updatedAt: Date;
}

const CollectionSchema = new Schema<ICollection>(
  {
    truck: {
      type: Schema.Types.ObjectId,
      ref: "Truck",
      required: true,
      index: true,
    },

    trips: [
      {
        type: Schema.Types.ObjectId,
        ref: "Trip",
        required: true,
      },
    ],

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    collectionDate: {
      type: Date,
      required: true,
      index: true,
    },

    coverageStartDate: {
      type: Date,
      default: null,
    },

    coverageEndDate: {
      type: Date,
      default: null,
    },

    soaNumber: {
      type: String,
      default: "",
      trim: true,
    },

    method: {
      type: String,
      default: "",
      trim: true,
    },

    reference: {
      type: String,
      default: "",
      trim: true,
    },

    billingType: {
      type: String,
      enum: ["Rate Only", "Rate + VAT"],
      required: true,
    },

    adjustments: {
      type: [
        {
          description: {
            type: String,
            required: true,
            trim: true,
          },

          type: {
            type: String,
            enum: ["Add", "Less"],
            required: true,
          },

          amount: {
            type: Number,
            required: true,
            min: 0,
          },
        },
      ],
      default: [],
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

CollectionSchema.index({ truck: 1, collectionDate: -1 });

export const Collection = mongoose.model<ICollection>(
  "Collection",
  CollectionSchema,
);
