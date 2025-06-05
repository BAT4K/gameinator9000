import { Router } from 'express';
import pool from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/quests - Create a new quest (protected)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const { title, description, reward } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO quests (creator_id, title, description, reward) VALUES ($1, $2, $3, $4) RETURNING id, creator_id, title, description, reward, created_at`,
      [userId, title, description, reward || null]
    );
    res.status(201).json({ quest: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create quest.' });
  }
});

// GET /api/quests - Get all quests for the authenticated user (protected)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.userId;
  try {
    const result = await pool.query(
      `SELECT * FROM quests WHERE creator_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ quests: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quests.' });
  }
});

export default router;
