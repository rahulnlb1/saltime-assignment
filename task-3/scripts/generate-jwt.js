const jwt = require('jsonwebtoken');
require('dotenv').config();

const tenantId = 'a1b2c3d4-e5f6-4789-a012-345678901234';
const secret = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-change-in-production';

const payload = {
  tenantId: tenantId,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
};

const token = jwt.sign(payload, secret);

console.log('JWT Token for testing:');
console.log('======================');
console.log(token);
console.log('');
console.log('Use this in the Authorization header:');
console.log(`Authorization: Bearer ${token}`);
console.log('');
console.log('Tenant ID:', tenantId);
console.log('Expires:', new Date(payload.exp * 1000).toISOString());