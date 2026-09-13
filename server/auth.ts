import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import type { UserRole, UserProfile } from '../src/types/index.js';

// Extend Express Request declaration
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      token?: string;
    }
  }
}

/**
 * Derives a cryptographically secure 512-bit key from password and salt using PBKDF2.
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

/**
 * Generates a random cryptographic salt.
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a cryptographically strong session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time comparison of password hashes to eliminate timing attack vectors.
 */
export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const computedHash = hashPassword(password, salt);
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Express middleware to authenticate requests via Bearer token.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid Bearer token.',
      code: 'UNAUTHORIZED',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      error: 'Bearer token is empty.',
      code: 'UNAUTHORIZED',
    });
  }

  const session = db.getSession(token);
  if (!session) {
    return res.status(401).json({
      error: 'Invalid or expired session. Please log in again.',
      code: 'INVALID_SESSION',
    });
  }

  const storedUser = db.getUserById(session.userId);
  if (!storedUser) {
    return res.status(401).json({
      error: 'User account not found.',
      code: 'USER_NOT_FOUND',
    });
  }

  req.user = {
    id: storedUser.id,
    email: storedUser.email,
    name: storedUser.name,
    role: storedUser.role,
    title: storedUser.title,
    avatar: storedUser.avatar,
    createdAt: storedUser.createdAt,
    lastLoginAt: storedUser.lastLoginAt,
  };
  req.token = token;
  next();
}

/**
 * Express middleware to enforce Role-Based Access Control (RBAC).
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access forbidden: Action requires one of [${allowedRoles.join(', ')}]. Your current role is ${req.user.role}.`,
        code: 'FORBIDDEN',
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}
