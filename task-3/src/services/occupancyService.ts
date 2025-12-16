import { db } from '../config/database';
import { redisClient } from '../config/redis';
import { 
  OccupancyEvent, 
  OccupancyEventInput, 
  UtilizationData, 
  RecommendationData,
  Room 
} from '../types';
import { logger } from '../utils/logger';

export class OccupancyService {
  
  async createOccupancyEvent(eventData: OccupancyEventInput): Promise<OccupancyEvent> {
    try {
      // Validate that room exists for the tenant
      const room = await db('rooms')
        .where({ 
          tenant_id: eventData.tenant_id, 
          room_id: eventData.room_id,
          active: true 
        })
        .first() as Room | undefined;

      if (!room) {
        throw new Error(`Room ${eventData.room_id} not found for tenant`);
      }

      const [event] = await db('occupancy_events')
        .insert({
          tenant_id: eventData.tenant_id,
          room_id: eventData.room_id,
          timestamp: new Date(eventData.timestamp),
          people_count: eventData.people_count,
          metadata: eventData.metadata || {}
        })
        .returning('*') as OccupancyEvent[];

      // Invalidate cache for this room's utilization
      const cacheKey = `utilization:${eventData.tenant_id}:${eventData.room_id}`;
      await redisClient.del(cacheKey);

      logger.info('Occupancy event created', {
        tenantId: eventData.tenant_id,
        roomId: eventData.room_id,
        peopleCount: eventData.people_count
      });

      return event;
    } catch (error) {
      logger.error('Error creating occupancy event:', error);
      throw error;
    }
  }

  async getUtilization(
    tenantId: string, 
    roomId: string, 
    days: number = 7
  ): Promise<UtilizationData | null> {
    try {
      const cacheKey = `utilization:${tenantId}:${roomId}:${days}d`;
      
      // Check cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.debug('Returning cached utilization data', { tenantId, roomId });
        return JSON.parse(cached);
      }

      // Get room information
      const room = await db('rooms')
        .where({ 
          tenant_id: tenantId, 
          room_id: roomId,
          active: true 
        })
        .first() as Room | undefined;

      if (!room) {
        return null;
      }

      // Calculate utilization for the specified period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const utilizationQuery = await db('occupancy_events')
        .where('tenant_id', tenantId)
        .where('room_id', roomId)
        .where('timestamp', '>=', startDate)
        .select(
          db.raw('AVG(people_count) as average_occupancy'),
          db.raw('COUNT(*) as total_events'),
          db.raw('MAX(people_count) as peak_occupancy')
        )
        .first();

      const averageOccupancy = Number(utilizationQuery?.average_occupancy) || 0;
      const totalEvents = Number(utilizationQuery?.total_events) || 0;
      const peakOccupancy = Number(utilizationQuery?.peak_occupancy) || 0;

      const utilizationData: UtilizationData = {
        room_id: roomId,
        room_name: room.name,
        average_utilization: averageOccupancy,
        total_events: totalEvents,
        peak_occupancy: peakOccupancy,
        capacity: room.capacity,
        utilization_percentage: room.capacity > 0 ? (averageOccupancy / room.capacity) * 100 : 0
      };

      // Cache for 1 hour
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(utilizationData));

      logger.info('Utilization calculated', {
        tenantId,
        roomId,
        utilizationPercentage: utilizationData.utilization_percentage
      });

      return utilizationData;
    } catch (error) {
      logger.error('Error calculating utilization:', error);
      throw error;
    }
  }

  async getRecommendations(
    tenantId: string, 
    officeId: string, 
    days: number = 30,
    threshold: number = 0.5
  ): Promise<RecommendationData[]> {
    try {
      const cacheKey = `recommendations:${tenantId}:${officeId}:${days}d:${threshold}`;
      
      // Check cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.debug('Returning cached recommendations', { tenantId, officeId });
        return JSON.parse(cached);
      }

      // Get all rooms in the office
      const rooms = await db('rooms')
        .where({ 
          tenant_id: tenantId, 
          office_id: officeId,
          active: true 
        })
        .select('*') as Room[];

      if (!rooms.length) {
        return [];
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Calculate utilization for each room
      const recommendations: RecommendationData[] = [];

      for (const room of rooms) {
        const utilizationQuery = await db('occupancy_events')
          .where('tenant_id', tenantId)
          .where('room_id', room.room_id)
          .where('timestamp', '>=', startDate)
          .select(
            db.raw('AVG(people_count) as average_occupancy'),
            db.raw('COUNT(*) as total_events')
          )
          .first();

        const averageOccupancy = Number(utilizationQuery?.average_occupancy) || 0;
        const totalEvents = Number(utilizationQuery?.total_events) || 0;
        const utilizationRate = room.capacity > 0 ? averageOccupancy / room.capacity : 0;

        let recommendation = '';
        let recommendationType: 'underutilized' | 'overutilized' | 'optimal' = 'optimal';
        let priority: 'low' | 'medium' | 'high' = 'low';
        let potentialSavings: number | undefined;

        if (utilizationRate < threshold * 0.5) {
          recommendationType = 'underutilized';
          priority = utilizationRate < threshold * 0.25 ? 'high' : 'medium';
          
          if (room.type === 'conference') {
            recommendation = `Conference room is severely underutilized (${(utilizationRate * 100).toFixed(1)}%). Consider converting to collaboration space or reducing room size.`;
            potentialSavings = this.calculateSavings(room.capacity, utilizationRate);
          } else {
            recommendation = `Space is underutilized. Consider flexible desk arrangements or consolidating with adjacent areas.`;
          }
        } else if (utilizationRate > threshold * 1.5) {
          recommendationType = 'overutilized';
          priority = utilizationRate > threshold * 2 ? 'high' : 'medium';
          recommendation = `Space is overutilized (${(utilizationRate * 100).toFixed(1)}% of capacity). Consider expanding capacity or improving booking efficiency.`;
        } else {
          recommendation = `Space utilization is optimal (${(utilizationRate * 100).toFixed(1)}% of capacity).`;
        }

        // Only include rooms with recommendations
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

      // Sort by priority and utilization
      recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Secondary sort by utilization deviation
        const thresholdDeviation = (rec: RecommendationData) => 
          Math.abs(rec.current_utilization - threshold);
        return thresholdDeviation(b) - thresholdDeviation(a);
      });

      // Cache for 4 hours
      await redisClient.setEx(cacheKey, 14400, JSON.stringify(recommendations));

      logger.info('Recommendations generated', {
        tenantId,
        officeId,
        recommendationCount: recommendations.length
      });

      return recommendations;
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      throw error;
    }
  }

  private calculateSavings(capacity: number, utilizationRate: number): number {
    // Simplified calculation: assume $50 per person capacity per month
    const costPerPersonPerMonth = 50;
    const underutilizedCapacity = capacity * (1 - utilizationRate);
    return underutilizedCapacity * costPerPersonPerMonth * 12; // Annual savings
  }

  async batchCreateOccupancyEvents(events: OccupancyEventInput[]): Promise<number> {
    try {
      const validEvents = [];
      
      // Validate all events before insertion
      for (const event of events) {
        const room = await db('rooms')
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

      await db('occupancy_events').insert(validEvents);

      // Clear relevant caches
      const tenantIds = [...new Set(events.map(e => e.tenant_id))];
      for (const tenantId of tenantIds) {
        const keys = await redisClient.keys(`*${tenantId}*`);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      }

      logger.info('Batch occupancy events created', {
        totalEvents: events.length,
        validEvents: validEvents.length
      });

      return validEvents.length;
    } catch (error) {
      logger.error('Error creating batch occupancy events:', error);
      throw error;
    }
  }
}