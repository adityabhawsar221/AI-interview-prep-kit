import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { UserModel, inMemoryUsers } from '../models/User.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if Mongo is connected
    const isMongoConnected = (mongoose as any).connection?.readyState === 1;

    if (isMongoConnected) {
      const existing = await UserModel.findOne({ email: normalizedEmail });
      if (existing) {
        res.status(409).json({ success: false, error: 'User with this email already exists.' });
        return;
      }

      const passwordHash = await hashPassword(password);
      const newUser = await UserModel.create({
        email: normalizedEmail,
        passwordHash,
      });

      const token = generateToken(newUser._id.toString());
      res.status(201).json({
        success: true,
        token,
        user: { id: newUser._id.toString(), email: newUser.email },
      });
      return;
    }

    // In-memory fallback
    for (const u of inMemoryUsers.values()) {
      if (u.email === normalizedEmail) {
        res.status(409).json({ success: false, error: 'User with this email already exists.' });
        return;
      }
    }

    const passwordHash = await hashPassword(password);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const memUser = {
      id: userId,
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date(),
    };
    inMemoryUsers.set(userId, memUser);

    const token = generateToken(userId);
    res.status(201).json({
      success: true,
      token,
      user: { id: userId, email: normalizedEmail },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Registration failed.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isMongoConnected = (mongoose as any).connection?.readyState === 1;

    if (isMongoConnected) {
      const user = await UserModel.findOne({ email: normalizedEmail });
      if (!user) {
        res.status(401).json({ success: false, error: 'Invalid email or password.' });
        return;
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ success: false, error: 'Invalid email or password.' });
        return;
      }

      const token = generateToken(user._id.toString());
      res.json({
        success: true,
        token,
        user: { id: user._id.toString(), email: user.email },
      });
      return;
    }

    // In-memory fallback
    let matchedUser: any = null;
    for (const u of inMemoryUsers.values()) {
      if (u.email === normalizedEmail) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const isValid = await comparePassword(password, matchedUser.passwordHash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const token = generateToken(matchedUser.id);
    res.json({
      success: true,
      token,
      user: { id: matchedUser.id, email: matchedUser.email },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Login failed.' });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const isMongoConnected = (mongoose as any).connection?.readyState === 1;

    if (isMongoConnected) {
      const user = await UserModel.findById(userId).select('-passwordHash');
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }
      res.json({ success: true, user: { id: user._id.toString(), email: user.email } });
      return;
    }

    const memUser = inMemoryUsers.get(userId);
    if (!memUser) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.json({ success: true, user: { id: memUser.id, email: memUser.email } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch user.' });
  }
}
