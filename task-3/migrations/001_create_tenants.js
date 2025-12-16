exports.up = function(knex) {
  return knex.schema.createTable('tenants', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('slug', 100).unique().notNullable();
    table.text('description');
    table.jsonb('settings').defaultTo('{}');
    table.boolean('active').defaultTo(true);
    table.timestamps(true, true);
    
    table.index('slug');
    table.index('active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tenants');
};