"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTenantParam = exports.authenticateTenant = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const authenticateTenant = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            res.status(401).json({ error: 'Access token is required' });
            return;
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            logger_1.logger.error('JWT_SECRET not configured');
            res.status(500).json({ error: 'Server configuration error' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const tenant = await (0, database_1.db)('tenants')
            .where({ id: decoded.tenantId, active: true })
            .first();
        if (!tenant) {
            res.status(403).json({ error: 'Invalid or inactive tenant' });
            return;
        }
        await (0, database_1.setTenantContext)(tenant.id);
        req.tenant = tenant;
        req.tenantId = tenant.id;
        logger_1.logger.info(`Request authenticated for tenant: ${tenant.slug}`, {
            tenantId: tenant.id,
            path: req.path,
            method: req.method
        });
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication error:', error);
        res.status(403).json({ error: 'Invalid token' });
    }
};
exports.authenticateTenant = authenticateTenant;
const validateTenantParam = (req, res, next) => {
    const paramTenantId = req.params.tenant_id;
    if (!req.tenantId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    if (paramTenantId && paramTenantId !== req.tenantId) {
        logger_1.logger.warn(`Tenant ID mismatch: authenticated=${req.tenantId}, param=${paramTenantId}`);
        res.status(403).json({ error: 'Tenant access violation' });
        return;
    }
    next();
};
exports.validateTenantParam = validateTenantParam;
