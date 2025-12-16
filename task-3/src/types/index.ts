export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  settings: Record<string, any>;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Office {
  id: string;
  tenant_id: string;
  name: string;
  location: string;
  address?: string;
  timezone: string;
  total_capacity: number;
  metadata: Record<string, any>;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Room {
  id: string;
  tenant_id: string;
  office_id: string;
  room_id: string;
  name: string;
  type: string;
  capacity: number;
  floor?: string;
  metadata: Record<string, any>;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OccupancyEvent {
  id: string;
  tenant_id: string;
  room_id: string;
  timestamp: Date;
  people_count: number;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface OccupancyEventInput {
  tenant_id: string;
  room_id: string;
  timestamp: string;
  people_count: number;
  metadata?: Record<string, any>;
}

export interface UtilizationData {
  room_id: string;
  room_name: string;
  average_utilization: number;
  total_events: number;
  peak_occupancy: number;
  capacity: number;
  utilization_percentage: number;
}

export interface RecommendationData {
  room_id: string;
  room_name: string;
  current_utilization: number;
  recommendation_type: 'underutilized' | 'overutilized' | 'optimal';
  recommendation: string;
  potential_savings?: number;
  priority: 'low' | 'medium' | 'high';
}

export interface AuthenticatedRequest extends Request {
  tenant?: Tenant;
  tenantId?: string;
}