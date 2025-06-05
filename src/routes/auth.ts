import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { authenticateToken, AuthRequest } from '../middleware/auth';

dotenv.config();

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res): Promise<void> => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }
  try {
    // Check if user exists
    const userExists = await pool.query(
      'SELECT 1 FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (userExists.rowCount > 0) {
      res.status(409).json({ error: 'Username or email already in use.' });
      return;
    }
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at`,
      [username, email, password_hash]
    );
    const user = result.rows[0];
    // Generate JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  try {
    // Find user by email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (result.rowCount === 0) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }
    const user = result.rows[0];
    // Compare password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }
    // Generate JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// GET /api/auth/me - Protected route
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// PUT /api/auth/me - Update user profile (protected)
router.put('/me', authenticateToken, async (req, res) => {
  const userId = (req as any).userId;
  const { username, email, currentPassword, newPassword } = req.body;
  if (!username && !email && !newPassword) {
    res.status(400).json({ error: 'No update fields provided.' });
    return;
  }
  try {
    // Fetch current user
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const user = userResult.rows[0];

    // Check for username/email uniqueness if changed
    if (username && username !== user.username) {
      const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
      if (exists.rowCount > 0) {
        res.status(409).json({ error: 'Username already in use.' });
        return;
      }
    }
    if (email && email !== user.email) {
      const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
      if (exists.rowCount > 0) {
        res.status(409).json({ error: 'Email already in use.' });
        return;
      }
    }

    // Prepare update fields
    let updateFields = [];
    let updateValues = [];
    let idx = 1;
    if (username && username !== user.username) {
      updateFields.push(`username = $${idx++}`);
      updateValues.push(username);
    }
    if (email && email !== user.email) {
      updateFields.push(`email = $${idx++}`);
      updateValues.push(email);
    }
    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current password required to set new password.' });
        return;
      }
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }
      const newHash = await bcrypt.hash(newPassword, 10);
      updateFields.push(`password_hash = $${idx++}`);
      updateValues.push(newHash);
    }
    if (updateFields.length === 0) {
      res.status(400).json({ error: 'No valid changes provided.' });
      return;
    }
    updateValues.push(userId);
    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${idx} RETURNING id, username, email, created_at`;
    const updated = await pool.query(updateQuery, updateValues);
    res.json({ user: updated.rows[0] });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Profile update failed.' });
  }
});

export default router;
