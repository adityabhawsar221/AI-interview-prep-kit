import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

// In-memory fallback repository if MongoDB is offline
export interface InMemoryUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export const inMemoryUsers: Map<string, InMemoryUser> = new Map();
