exports.up = function(knex) {
  return knex.schema.createTable('offices', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('location', 255).notNullable();
    table.string('address', 500);
    table.string('timezone', 50).defaultTo('UTC');
    table.integer('total_capacity').defaultTo(0);
    table.jsonb('metadata').defaultTo('{}');
    table.boolean('active').defaultTo(true);
    table.timestamps(true, true);
    
    table.index(['tenant_id', 'active']);
    table.index('location');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('offices');
};