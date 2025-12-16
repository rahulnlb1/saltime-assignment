import { Response } from 'express';
import { OccupancyService } from '../services/occupancyService';
import { AuthenticatedRequest, OccupancyEventInput } from '../types';
import { logger } from '../utils/logger';

export class OccupancyController {
  private occupancyService: OccupancyService;

  constructor() {
    this.occupancyService = new OccupancyService();
  }

  async createEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const eventData: OccupancyEventInput = req.body;

      // Ensure tenant_id matches authenticated tenant
      if (eventData.tenant_id !== req.tenantId) {
        res.status(403).json({ error: 'Tenant access violation' });
        return;
      }

      const event = await this.occupancyService.createOccupancyEvent(eventData);

      logger.info('Occupancy event created via API', {
        tenantId: req.tenantId,
        roomId: eventData.room_id,
        eventId: event.id
      });

      res.status(201).json({
        success: true,
        data: event
      });
    } catch (error) {
      logger.error('Error in createEvent controller:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  async batchCreateEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const events: OccupancyEventInput[] = req.body.events;

      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Events array is required and cannot be empty'
        });
        return;
      }

      // Validate all events belong to the authenticated tenant
      const invalidEvents = events.filter(event => event.tenant_id !== req.tenantId);
      if (invalidEvents.length > 0) {
        res.status(403).json({
          success: false,
          error: 'All events must belong to the authenticated tenant'
        });
        return;
      }

      const processedCount = await this.occupancyService.batchCreateOccupancyEvents(events);

      logger.info('Batch occupancy events created via API', {
        tenantId: req.tenantId,
        totalEvents: events.length,
        processedEvents: processedCount
      });

      res.status(201).json({
        success: true,
        data: {
          total_submitted: events.length,
          total_processed: processedCount,
          message: `Successfully processed ${processedCount} out of ${events.length} events`
        }
      });
    } catch (error) {
      logger.error('Error in batchCreateEvents controller:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getUtilization(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { tenant_id, room_id } = req.params;
      const days = parseInt(req.query.days as string) || 7;

      // Validate tenant access
      if (tenant_id !== req.tenantId) {
        res.status(403).json({
          success: false,
          error: 'Tenant access violation'
        });
        return;
      }

      const utilization = await this.occupancyService.getUtilization(
        tenant_id,
        room_id,
        days
      );

      if (!utilization) {
        res.status(404).json({
          success: false,
          error: 'Room not found or no data available'
        });
        return;
      }

      logger.info('Utilization data retrieved via API', {
        tenantId: req.tenantId,
        roomId: room_id,
        days
      });

      res.json({
        success: true,
        data: utilization
      });
    } catch (error) {
      logger.error('Error in getUtilization controller:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { tenant_id, office_id } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      const threshold = parseFloat(req.query.threshold as string) || 0.5;

      // Validate tenant access
      if (tenant_id !== req.tenantId) {
        res.status(403).json({
          success: false,
          error: 'Tenant access violation'
        });
        return;
      }

      const recommendations = await this.occupancyService.getRecommendations(
        tenant_id,
        office_id,
        days,
        threshold
      );

      logger.info('Recommendations retrieved via API', {
        tenantId: req.tenantId,
        officeId: office_id,
        recommendationCount: recommendations.length
      });

      res.json({
        success: true,
        data: {
          office_id,
          analysis_period_days: days,
          utilization_threshold: threshold,
          recommendations,
          summary: {
            total_rooms_analyzed: recommendations.length,
            underutilized: recommendations.filter(r => r.recommendation_type === 'underutilized').length,
            overutilized: recommendations.filter(r => r.recommendation_type === 'overutilized').length,
            optimal: recommendations.filter(r => r.recommendation_type === 'optimal').length,
            total_potential_savings: recommendations
              .reduce((sum, r) => sum + (r.potential_savings || 0), 0)
          }
        }
      });
    } catch (error) {
      logger.error('Error in getRecommendations controller:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async healthCheck(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          service: 'workplace-optimization-api',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          tenant: req.tenant?.slug || 'unknown'
        }
      });
    } catch (error) {
      logger.error('Error in healthCheck controller:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}