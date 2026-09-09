import mongoose, { Schema, Document } from 'mongoose';
import { WorkingKit } from '../pipeline/schema.js';

export interface IKitDoc extends Document {
  userId: string;
  company: string;
  role: string;
  days_available: number;
  source: WorkingKit['source'];
  company_brief: WorkingKit['company_brief'];
  questions: WorkingKit['questions'];
  flashcards: WorkingKit['flashcards'];
  schedule: WorkingKit['schedule'];
  coverage: WorkingKit['coverage'];
  data: WorkingKit;
  createdAt: Date;
  updatedAt: Date;
}

const KitSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    company: { type: String, required: true },
    role: { type: String, required: true },
    days_available: { type: Number, required: true },
    source: { type: Schema.Types.Mixed, required: true },
    company_brief: { type: Schema.Types.Mixed, required: true },
    questions: { type: Schema.Types.Mixed, required: true },
    flashcards: { type: Schema.Types.Mixed, required: true },
    schedule: { type: Schema.Types.Mixed, required: true },
    coverage: { type: Schema.Types.Mixed, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const KitModel = mongoose.models.Kit || mongoose.model<IKitDoc>('Kit', KitSchema);

// In-memory fallback repository for kits
export interface InMemoryKit {
  id: string;
  userId: string;
  company: string;
  role: string;
  days_available: number;
  data: WorkingKit;
  createdAt: Date;
  updatedAt: Date;
}

export const inMemoryKits: Map<string, InMemoryKit> = new Map();
