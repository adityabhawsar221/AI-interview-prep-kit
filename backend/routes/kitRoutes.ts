import { Router } from 'express';
import {
  generateKit,
  getJobStatus,
  getUserKits,
  getKitById,
  updateKit,
  regenerateSection,
  deleteKit,
} from '../controllers/kitController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/generate', authMiddleware, generateKit);
router.get('/jobs/:jobId', authMiddleware, getJobStatus);
router.get('/', authMiddleware, getUserKits);
router.get('/:id', authMiddleware, getKitById);
router.put('/:id', authMiddleware, updateKit);
router.delete('/:id', authMiddleware, deleteKit);
router.post('/:id/regenerate-section', authMiddleware, regenerateSection);

export default router;
