"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const occupancyController_1 = require("../controllers/occupancyController");
const tenantAuth_1 = require("../middleware/tenantAuth");
const validation_1 = require("../middleware/validation");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)();
const controller = new occupancyController_1.OccupancyController();
const generalLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
const eventIngestionLimit = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 1000,
    message: 'Event ingestion rate limit exceeded.'
});
router.use(tenantAuth_1.authenticateTenant);
router.get('/health', controller.healthCheck.bind(controller));
router.post('/events', eventIngestionLimit, validation_1.validateOccupancyEvent, controller.createEvent.bind(controller));
router.post('/events/batch', eventIngestionLimit, controller.batchCreateEvents.bind(controller));
router.get('/utilization/:tenant_id/:room_id', generalLimit, tenantAuth_1.validateTenantParam, validation_1.validateUtilizationParams, controller.getUtilization.bind(controller));
router.get('/recommend/:tenant_id/:office_id', generalLimit, tenantAuth_1.validateTenantParam, validation_1.validateRecommendationParams, controller.getRecommendations.bind(controller));
exports.default = router;
