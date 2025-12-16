"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OccupancyService = void 0;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
class OccupancyService {
    async createOccupancyEvent(eventData) {
        try {
            const room = await (0, database_1.db)('rooms')
                .where({
                tenant_id: eventData.tenant_id,
                room_id: eventData.room_id,
                active: true
            })
                .first();
            if (!room) {
                throw new Error(`Room ${eventData.room_id} not found for tenant`);
            }
            const [event] = await (0, database_1.db)('occupancy_events')
                .insert({
                tenant_id: eventData.tenant_id,
                room_id: eventData.room_id,
                timestamp: new Date(eventData.timestamp),
                people_count: eventData.people_count,
                metadata: eventData.metadata || {}
            })
                .returning('*');
            const cacheKey = `utilization:${eventData.tenant_id}:${eventData.room_id}`;
            await redis_1.redisClient.del(cacheKey);
            logger_1.logger.info('Occupancy event created', {
                tenantId: eventData.tenant_id,
                roomId: eventData.room_id,
                peopleCount: eventData.people_count
            });
            return event;
        }
        catch (error) {
            logger_1.logger.error('Error creating occupancy event:', error);
            throw error;
        }
    }
    async getUtilization(tenantId, roomId, days = 7) {
        try {
            const cacheKey = `utilization:${tenantId}:${roomId}:${days}d`;
            const cached = await redis_1.redisClient.get(cacheKey);
            if (cached) {
                logger_1.logger.debug('Returning cached utilization data', { tenantId, roomId });
                return JSON.parse(cached);
            }
            const room = await (0, database_1.db)('rooms')
                .where({
                tenant_id: tenantId,
                room_id: roomId,
                active: true
            })
                .first();
            if (!room) {
                return null;
            }
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const utilizationQuery = await (0, database_1.db)('occupancy_events')
                .where('tenant_id', tenantId)
                .where('room_id', roomId)
                .where('timestamp', '>=', startDate)
                .select(database_1.db.raw('AVG(people_count) as average_occupancy'), database_1.db.raw('COUNT(*) as total_events'), database_1.db.raw('MAX(people_count) as peak_occupancy'))
                .first();
            const averageOccupancy = Number(utilizationQuery?.average_occupancy) || 0;
            const totalEvents = Number(utilizationQuery?.total_events) || 0;
            const peakOccupancy = Number(utilizationQuery?.peak_occupancy) || 0;
            const utilizationData = {
                room_id: roomId,
                room_name: room.name,
                average_utilization: averageOccupancy,
                total_events: totalEvents,
                peak_occupancy: peakOccupancy,
                capacity: room.capacity,
                utilization_percentage: room.capacity > 0 ? (averageOccupancy / room.capacity) * 100 : 0
            };
            await redis_1.redisClient.setEx(cacheKey, 3600, JSON.stringify(utilizationData));
            logger_1.logger.info('Utilization calculated', {
                tenantId,
                roomId,
                utilizationPercentage: utilizationData.utilization_percentage
            });
            return utilizationData;
        }
        catch (error) {
            logger_1.logger.error('Error calculating utilization:', error);
            throw error;
        }
    }
    async getRecommendations(tenantId, officeId, days = 30, threshold = 0.5) {
        try {
            const cacheKey = `recommendations:${tenantId}:${officeId}:${days}d:${threshold}`;
            const cached = await redis_1.redisClient.get(cacheKey);
            if (cached) {
                logger_1.logger.debug('Returning cached recommendations', { tenantId, officeId });
                return JSON.parse(cached);
            }
            const rooms = await (0, database_1.db)('rooms')
                .where({
                tenant_id: tenantId,
                office_id: officeId,
                active: true
            })
                .select('*');
            if (!rooms.length) {
                return [];
            }
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const recommendations = [];
            for (const room of rooms) {
                const utilizationQuery = await (0, database_1.db)('occupancy_events')
                    .where('tenant_id', tenantId)
                    .where('room_id', room.room_id)
                    .where('timestamp', '>=', startDate)
                    .select(database_1.db.raw('AVG(people_count) as average_occupancy'), database_1.db.raw('COUNT(*) as total_events'))
                    .first();
                const averageOccupancy = Number(utilizationQuery?.average_occupancy) || 0;
                const totalEvents = Number(utilizationQuery?.total_events) || 0;
                const utilizationRate = room.capacity > 0 ? averageOccupancy / room.capacity : 0;
                let recommendation = '';
                let recommendationType = 'optimal';
                let priority = 'low';
                let potentialSavings;
                if (utilizationRate < threshold * 0.5) {
                    recommendationType = 'underutilized';
                    priority = utilizationRate < threshold * 0.25 ? 'high' : 'medium';
                    if (room.type === 'conference') {
                        recommendation = `Conference room is severely underutilized (${(utilizationRate * 100).toFixed(1)}%). Consider converting to collaboration space or reducing room size.`;
                        potentialSavings = this.calculateSavings(room.capacity, utilizationRate);
                    }
                    else {
                        recommendation = `Space is underutilized. Consider flexible desk arrangements or consolidating with adjacent areas.`;
                    }
                }
                else if (utilizationRate > threshold * 1.5) {
                    recommendationType = 'overutilized';
                    priority = utilizationRate > threshold * 2 ? 'high' : 'medium';
                    recommendation = `Space is overutilized (${(utilizationRate * 100).toFixed(1)}% of capacity). Consider expanding capacity or improving booking efficiency.`;
                }
                else {
                    recommendation = `Space utilization is optimal (${(utilizationRate * 100).toFixed(1)}% of capacity).`;
                }
                if (recommendationType !== 'optimal' || totalEvents > 0) {
                    recommendations.push({
                        room_id: room.room_id,
                        room_name: room.name,
                        current_utilization: utilizationRate,
                        recommendation_type: recommendationType,
                        recommendation,
                        potential_savings: potentialSavings,
                        priority
                    });
                }
            }
            recommendations.sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0)
                    return priorityDiff;
                const thresholdDeviation = (rec) => Math.abs(rec.current_utilization - threshold);
                return thresholdDeviation(b) - thresholdDeviation(a);
            });
            await redis_1.redisClient.setEx(cacheKey, 14400, JSON.stringify(recommendations));
            logger_1.logger.info('Recommendations generated', {
                tenantId,
                officeId,
                recommendationCount: recommendations.length
            });
            return recommendations;
        }
        catch (error) {
            logger_1.logger.error('Error generating recommendations:', error);
            throw error;
        }
    }
    calculateSavings(capacity, utilizationRate) {
        const costPerPersonPerMonth = 50;
        const underutilizedCapacity = capacity * (1 - utilizationRate);
        return underutilizedCapacity * costPerPersonPerMonth * 12;
    }
    async batchCreateOccupancyEvents(events) {
        try {
            const validEvents = [];
            for (const event of events) {
                const room = await (0, database_1.db)('rooms')
                    .where({
                    tenant_id: event.tenant_id,
                    room_id: event.room_id,
                    active: true
                })
                    .first();
                if (room) {
                    validEvents.push({
                        tenant_id: event.tenant_id,
                        room_id: event.room_id,
                        timestamp: new Date(event.timestamp),
                        people_count: event.people_count,
                        metadata: event.metadata || {}
                    });
                }
            }
            if (validEvents.length === 0) {
                throw new Error('No valid events to insert');
            }
            await (0, database_1.db)('occupancy_events').insert(validEvents);
            const tenantIds = [...new Set(events.map(e => e.tenant_id))];
            for (const tenantId of tenantIds) {
                const keys = await redis_1.redisClient.keys(`*${tenantId}*`);
                if (keys.length > 0) {
                    await redis_1.redisClient.del(keys);
                }
            }
            logger_1.logger.info('Batch occupancy events created', {
                totalEvents: events.length,
                validEvents: validEvents.length
            });
            return validEvents.length;
        }
        catch (error) {
            logger_1.logger.error('Error creating batch occupancy events:', error);
            throw error;
        }
    }
}
exports.OccupancyService = OccupancyService;
