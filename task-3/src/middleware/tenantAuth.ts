import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, setTenantContext } from '../config/database';
import { Tenant, AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';

interface JWTPayload {
  tenantId: string;
  iat: number;
  exp: number;
}

export const authenticateTenant = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({ error: 'Access token is required' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('JWT_SECRET not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    // Validate tenant exists and is active
    const tenant = await db('tenants')
      .where({ id: decoded.tenantId, active: true })
      .first() as Tenant | undefined;

    if (!tenant) {
      res.status(403).json({ error: 'Invalid or inactive tenant' });
      return;
    }

    // Set tenant context for Row-Level Security
    await setTenantContext(tenant.id);

    req.tenant = tenant;
    req.tenantId = tenant.id;

    logger.info(`Request authenticated for tenant: ${tenant.slug}`, {
      tenantId: tenant.id,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware to validate tenant_id in request params matches authenticated tenant
export const validateTenantParam = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const paramTenantId = req.params.tenant_id;
  
  if (!req.tenantId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (paramTenantId && paramTenantId !== req.tenantId) {
    logger.warn(`Tenant ID mismatch: authenticated=${req.tenantId}, param=${paramTenantId}`);
    res.status(403).json({ error: 'Tenant access violation' });
    return;
  }

  next();
};