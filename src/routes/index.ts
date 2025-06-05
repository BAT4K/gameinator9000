// src/routes/index.ts
import { Router } from 'express';

const router = Router();

// Example route
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to Game-inator9000 API!' });
});

export default router;
