exports.up = function(knex) {
  return knex.schema.createTable('rooms', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('office_id').notNullable().references('id').inTable('offices').onDelete('CASCADE');
    table.string('room_id', 100).notNullable(); // External room identifier
    table.string('name', 255).notNullable();
    table.string('type', 50).defaultTo('general'); // conference, office, collaboration, etc.
    table.integer('capacity').defaultTo(1);
    table.string('floor', 10);
    table.jsonb('metadata').defaultTo('{}');
    table.boolean('active').defaultTo(true);
    table.timestamps(true, true);
    
    table.unique(['tenant_id', 'room_id']);
    table.index(['tenant_id', 'office_id', 'active']);
    table.index(['tenant_id', 'type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('rooms');
};