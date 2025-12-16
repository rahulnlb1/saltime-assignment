exports.up = function(knex) {
  return knex.schema.createTable('occupancy_events', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('room_id', 100).notNullable();
    table.timestamp('timestamp').notNullable();
    table.integer('people_count').notNullable().defaultTo(0);
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    table.index(['tenant_id', 'room_id', 'timestamp']);
    table.index(['tenant_id', 'timestamp']);
    
    // Foreign key to rooms table
    table.foreign(['tenant_id', 'room_id']).references(['tenant_id', 'room_id']).inTable('rooms');
  });
  
  // Add row-level security for tenant isolation
  return knex.raw(`
    ALTER TABLE occupancy_events ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY tenant_isolation_occupancy_events ON occupancy_events
      FOR ALL TO PUBLIC
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
  `);
};

exports.down = function(knex) {
  return knex.raw('DROP POLICY IF EXISTS tenant_isolation_occupancy_events ON occupancy_events')
    .then(() => knex.schema.dropTable('occupancy_events'));
};