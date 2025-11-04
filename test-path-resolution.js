// Quick test of path resolution
const { resolveUUID } = require('./dist/utils/path-resolver.js');

const uuid = 'design-system-v1-0-0';
const resolution = resolveUUID(uuid);

console.log('Testing UUID:', uuid);
console.log('Resolution result:', JSON.stringify(resolution, null, 2));
console.log('Expected zipKey:', 'design-system/v1.0.0/storybook.zip');
console.log('Expected bucket:', 'UPLOAD_BUCKET');
