import mongoose from 'mongoose';

export async function connectDatabase(): Promise<boolean> {
  const mongoUri =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/interview_prep_kit';

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 4000,
    } as mongoose.ConnectOptions);
    console.log(`[MongoDB] Connected successfully to database cluster.`);
    return true;
  } catch (err: any) {
    console.warn(
      `[MongoDB Warning] Could not connect to MongoDB. Web server will run in in-memory storage fallback mode.`
    );
    return false;
  }
}
