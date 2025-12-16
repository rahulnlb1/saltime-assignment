import { Router } from 'express';
import { OccupancyController } from '../controllers/occupancyController';
import { authenticateTenant, validateTenantParam } from '../middleware/tenantAuth';
import { 
  validateOccupancyEvent, 
  validateUtilizationParams,
  validateRecommendationParams 
} from '../middleware/validation';
import rateLimit from 'express-rate-limit';

const router = Router();
const controller = new OccupancyController();

// Rate limiting for different endpoints
const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later.'
});

const eventIngestionLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 events per minute for high-volume IoT data
  message: 'Event ingestion rate limit exceeded.'
});

// Apply authentication to all routes
router.use(authenticateTenant);

// Health check
router.get('/health', controller.healthCheck.bind(controller));

// Occupancy event ingestion
router.post(
  '/events',
  eventIngestionLimit,
  validateOccupancyEvent,
  controller.createEvent.bind(controller)
);

// Batch event ingestion
router.post(
  '/events/batch',
  eventIngestionLimit,
  controller.batchCreateEvents.bind(controller)
);

// Utilization endpoint: GET /utilization/:tenant_id/:room_id
router.get(
  '/utilization/:tenant_id/:room_id',
  generalLimit,
  validateTenantParam,
  validateUtilizationParams,
  controller.getUtilization.bind(controller)
);

// Recommendations endpoint: GET /recommend/:tenant_id/:office_id
router.get(
  '/recommend/:tenant_id/:office_id',
  generalLimit,
  validateTenantParam,
  validateRecommendationParams,
  controller.getRecommendations.bind(controller)
);

export default router;