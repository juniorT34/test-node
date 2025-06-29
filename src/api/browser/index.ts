import { Router } from 'express';
import { startSession, validateStartSession } from './startSession';
import { stopSession, validateStopSession } from './stopSession';
import { getRemainingTime, validateRemainingTime } from './remainingTime';
import { extendSession, validateExtendSession } from './extendSession';
import { createSessionRateLimiter } from '../../services/rateLimiter';

const router = Router();

// Apply session-specific rate limiting
const sessionRateLimiter = createSessionRateLimiter();

// Session management routes
router.post('/start-session', sessionRateLimiter, validateStartSession, startSession);
router.post('/stop-session', validateStopSession, stopSession);
router.get('/remaining-time', validateRemainingTime, getRemainingTime);
router.post('/extend-session', validateExtendSession, extendSession);

export default router; 