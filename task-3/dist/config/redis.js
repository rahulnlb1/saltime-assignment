"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = exports.redisClient = void 0;
const redis_1 = require("redis");
const logger_1 = require("../utils/logger");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
exports.redisClient = (0, redis_1.createClient)({
    url: redisUrl,
});
exports.redisClient.on('error', (err) => {
    logger_1.logger.error('Redis client error:', err);
});
exports.redisClient.on('connect', () => {
    logger_1.logger.info('Redis client connected');
});
const connectRedis = async () => {
    try {
        await exports.redisClient.connect();
        logger_1.logger.info('Redis connection established');
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to Redis:', error);
        process.exit(1);
    }
};
exports.connectRedis = connectRedis;
exports.default = exports.redisClient;
