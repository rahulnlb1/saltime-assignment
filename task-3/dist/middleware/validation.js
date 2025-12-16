"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRecommendationParams = exports.validateUtilizationParams = exports.validateOccupancyEvent = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../utils/logger");
const validateOccupancyEvent = (req, res, next) => {
    const schema = joi_1.default.object({
        tenant_id: joi_1.default.string().uuid().required(),
        room_id: joi_1.default.string().min(1).max(100).required(),
        timestamp: joi_1.default.string().isoDate().required(),
        people_count: joi_1.default.number().integer().min(0).max(1000).required(),
        metadata: joi_1.default.object().optional()
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
        logger_1.logger.warn('Validation error:', { error: error.details, body: req.body });
        res.status(400).json({
            error: 'Invalid request data',
            details: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }))
        });
        return;
    }
    req.body = value;
    next();
};
exports.validateOccupancyEvent = validateOccupancyEvent;
const validateUtilizationParams = (req, res, next) => {
    const schema = joi_1.default.object({
        tenant_id: joi_1.default.string().uuid().required(),
        room_id: joi_1.default.string().min(1).max(100).required(),
        days: joi_1.default.number().integer().min(1).max(365).optional().default(7)
    });
    const { error, value } = schema.validate({
        tenant_id: req.params.tenant_id,
        room_id: req.params.room_id,
        days: req.query.days
    });
    if (error) {
        logger_1.logger.warn('Validation error:', { error: error.details, params: req.params, query: req.query });
        res.status(400).json({
            error: 'Invalid request parameters',
            details: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }))
        });
        return;
    }
    req.params = { ...req.params, ...value };
    next();
};
exports.validateUtilizationParams = validateUtilizationParams;
const validateRecommendationParams = (req, res, next) => {
    const schema = joi_1.default.object({
        tenant_id: joi_1.default.string().uuid().required(),
        office_id: joi_1.default.string().uuid().required(),
        days: joi_1.default.number().integer().min(1).max(365).optional().default(30),
        threshold: joi_1.default.number().min(0).max(1).optional().default(0.5)
    });
    const { error, value } = schema.validate({
        tenant_id: req.params.tenant_id,
        office_id: req.params.office_id,
        days: req.query.days,
        threshold: req.query.threshold
    });
    if (error) {
        logger_1.logger.warn('Validation error:', { error: error.details, params: req.params, query: req.query });
        res.status(400).json({
            error: 'Invalid request parameters',
            details: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }))
        });
        return;
    }
    req.params = { ...req.params, ...value };
    next();
};
exports.validateRecommendationParams = validateRecommendationParams;
