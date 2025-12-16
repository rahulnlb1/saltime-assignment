exports.seed = async function(knex) {
  // Clear existing data
  await knex('occupancy_events').del();
  await knex('rooms').del();
  await knex('offices').del();
  await knex('tenants').del();

  // Insert sample tenant
  const [tenant] = await knex('tenants').insert([
    {
      id: 'a1b2c3d4-e5f6-4789-a012-345678901234',
      name: 'Global Bank Corp',
      slug: 'bank123',
      description: 'Large multinational banking corporation',
      settings: JSON.stringify({
        timezone: 'UTC',
        currency: 'USD',
        utilization_threshold: 0.7
      }),
      active: true
    }
  ]).returning('*');

  // Insert sample offices
  const offices = await knex('offices').insert([
    {
      id: 'b2c3d4e5-f6a7-4890-b123-456789012345',
      tenant_id: tenant.id,
      name: 'New York Headquarters',
      location: 'New York, NY',
      address: '123 Financial District, New York, NY 10004',
      timezone: 'America/New_York',
      total_capacity: 500,
      metadata: JSON.stringify({
        floors: 15,
        building_type: 'headquarters',
        amenities: ['cafeteria', 'gym', 'parking']
      })
    },
    {
      id: 'c3d4e5f6-a7b8-4901-c234-567890123456',
      tenant_id: tenant.id,
      name: 'London Branch',
      location: 'London, UK',
      address: '456 Canary Wharf, London E14 5AB, UK',
      timezone: 'Europe/London',
      total_capacity: 300,
      metadata: JSON.stringify({
        floors: 8,
        building_type: 'branch',
        amenities: ['cafeteria', 'parking']
      })
    }
  ]).returning('*');

  // Insert sample rooms for New York office
  const nyRooms = await knex('rooms').insert([
    {
      tenant_id: tenant.id,
      office_id: offices[0].id,
      room_id: 'confA',
      name: 'Conference Room A',
      type: 'conference',
      capacity: 12,
      floor: '15',
      metadata: JSON.stringify({
        equipment: ['projector', 'video_conference', 'whiteboard'],
        booking_required: true
      })
    },
    {
      tenant_id: tenant.id,
      office_id: offices[0].id,
      room_id: 'confB',
      name: 'Conference Room B',
      type: 'conference',
      capacity: 8,
      floor: '15',
      metadata: JSON.stringify({
        equipment: ['projector', 'whiteboard'],
        booking_required: true
      })
    },
    {
      tenant_id: tenant.id,
      office_id: offices[0].id,
      room_id: 'collab1',
      name: 'Collaboration Zone 1',
      type: 'collaboration',
      capacity: 6,
      floor: '10',
      metadata: JSON.stringify({
        equipment: ['whiteboard', 'standing_desk'],
        booking_required: false
      })
    },
    {
      tenant_id: tenant.id,
      office_id: offices[0].id,
      room_id: 'phone1',
      name: 'Phone Booth 1',
      type: 'phone_booth',
      capacity: 1,
      floor: '12',
      metadata: JSON.stringify({
        equipment: ['phone'],
        soundproof: true
      })
    }
  ]).returning('*');

  // Insert sample rooms for London office
  const londonRooms = await knex('rooms').insert([
    {
      tenant_id: tenant.id,
      office_id: offices[1].id,
      room_id: 'london_conf1',
      name: 'Thames Conference Room',
      type: 'conference',
      capacity: 10,
      floor: '5',
      metadata: JSON.stringify({
        equipment: ['projector', 'video_conference'],
        booking_required: true
      })
    },
    {
      tenant_id: tenant.id,
      office_id: offices[1].id,
      room_id: 'london_collab1',
      name: 'Innovation Lab',
      type: 'collaboration',
      capacity: 8,
      floor: '3',
      metadata: JSON.stringify({
        equipment: ['whiteboard', 'creative_supplies'],
        booking_required: false
      })
    }
  ]).returning('*');

  // Insert sample occupancy events for the last 30 days
  const occupancyEvents = [];
  const now = new Date();
  
  // Generate realistic occupancy data
  for (let days = 30; days >= 0; days--) {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    
    // Skip weekends for more realistic office data
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // Generate events throughout the day (9 AM to 6 PM)
    for (let hour = 9; hour <= 18; hour++) {
      const eventTime = new Date(date);
      eventTime.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
      
      // Conference Room A (often underutilized)
      if (Math.random() < 0.3) { // 30% chance of being used
        occupancyEvents.push({
          tenant_id: tenant.id,
          room_id: 'confA',
          timestamp: eventTime,
          people_count: Math.floor(Math.random() * 4) + 1, // 1-4 people (underutilized)
        });
      }
      
      // Conference Room B (better utilization)
      if (Math.random() < 0.6) { // 60% chance of being used
        occupancyEvents.push({
          tenant_id: tenant.id,
          room_id: 'confB',
          timestamp: eventTime,
          people_count: Math.floor(Math.random() * 6) + 2, // 2-7 people (good utilization)
        });
      }
      
      // Collaboration Zone (high utilization)
      if (Math.random() < 0.8) { // 80% chance of being used
        occupancyEvents.push({
          tenant_id: tenant.id,
          room_id: 'collab1',
          timestamp: eventTime,
          people_count: Math.floor(Math.random() * 5) + 3, // 3-7 people (good utilization)
        });
      }
      
      // Phone Booth (random usage)
      if (Math.random() < 0.4) { // 40% chance of being used
        occupancyEvents.push({
          tenant_id: tenant.id,
          room_id: 'phone1',
          timestamp: eventTime,
          people_count: 1, // Always 1 person
        });
      }
      
      // London rooms (similar patterns but different times due to timezone)
      if (Math.random() < 0.5) {
        occupancyEvents.push({
          tenant_id: tenant.id,
          room_id: 'london_conf1',
          timestamp: eventTime,
          people_count: Math.floor(Math.random() * 7) + 2, // 2-8 people
        });
      }
      
      if (Math.random() < 0.7) {
        occupancyEvents.push({
          tenant_id: tenant.id,
          room_id: 'london_collab1',
          timestamp: eventTime,
          people_count: Math.floor(Math.random() * 6) + 2, // 2-7 people
        });
      }
    }
  }

  // Insert occupancy events in batches to avoid memory issues
  const batchSize = 1000;
  for (let i = 0; i < occupancyEvents.length; i += batchSize) {
    const batch = occupancyEvents.slice(i, i + batchSize);
    await knex('occupancy_events').insert(batch);
  }

  console.log(`Seeded ${occupancyEvents.length} occupancy events`);
  console.log('Sample tenant ID:', tenant.id);
  console.log('Use this tenant ID for JWT tokens and API calls');
};