import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export const validateOccupancyEvent = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    tenant_id: Joi.string().uuid().required(),
    room_id: Joi.string().min(1).max(100).required(),
    timestamp: Joi.string().isoDate().required(),
    people_count: Joi.number().integer().min(0).max(1000).required(),
    metadata: Joi.object().optional()
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    logger.warn('Validation error:', { error: error.details, body: req.body });
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

export const validateUtilizationParams = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    tenant_id: Joi.string().uuid().required(),
    room_id: Joi.string().min(1).max(100).required(),
    days: Joi.number().integer().min(1).max(365).optional().default(7)
  });

  const { error, value } = schema.validate({
    tenant_id: req.params.tenant_id,
    room_id: req.params.room_id,
    days: req.query.days
  });

  if (error) {
    logger.warn('Validation error:', { error: error.details, params: req.params, query: req.query });
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

export const validateRecommendationParams = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    tenant_id: Joi.string().uuid().required(),
    office_id: Joi.string().uuid().required(),
    days: Joi.number().integer().min(1).max(365).optional().default(30),
    threshold: Joi.number().min(0).max(1).optional().default(0.5)
  });

  const { error, value } = schema.validate({
    tenant_id: req.params.tenant_id,
    office_id: req.params.office_id,
    days: req.query.days,
    threshold: req.query.threshold
  });

  if (error) {
    logger.warn('Validation error:', { error: error.details, params: req.params, query: req.query });
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