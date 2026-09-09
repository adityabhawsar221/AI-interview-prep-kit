import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import kitRoutes from './routes/kitRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env'), override: true });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: true, // Dynamically allows the requesting origin (Vercel, localhost, etc.)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-api-key', 'x-api-key'],
  })
);
app.use(express.json({ limit: '5mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/kits', kitRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ai-interview-prep-backend',
    gemini_key_configured: Boolean(process.env.GEMINI_API_KEY),
    openai_key_configured: Boolean(process.env.OPENAI_API_KEY),
    groq_key_configured: Boolean(process.env.GROQ_API_KEY),
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
async function startServer() {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`[PrepKit Backend Server] Listening on http://localhost:${PORT}`);
    console.log(
      `[PrepKit Backend Server] Gemini API Key status: ${
        process.env.GEMINI_API_KEY ? 'ACTIVE (Live AI generation enabled)' : 'NOT_FOUND'
      }`
    );
  });
}

startServer().catch((err) => {
  console.error('[PrepKit Fatal Startup Error]:', err);
});
