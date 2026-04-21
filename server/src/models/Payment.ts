import { Schema, model, Document, Types } from "mongoose";

export interface IPayment extends Document {
  truck: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  category: string;
  recipient: string;
  amount: number;
  method: string;
  date: Date;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    truck: { type: Schema.Types.ObjectId, ref: "Truck", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    category: { type: String, required: true, trim: true },
    recipient: { type: String, default: "", trim: true },
    amount: { type: Number, default: 0 },
    method: { type: String, default: "", trim: true },

    date: { type: Date, required: true },
    filename: { type: String, required: true },
    originalFilename: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

export const Payment = model<IPayment>("Payment", PaymentSchema);
