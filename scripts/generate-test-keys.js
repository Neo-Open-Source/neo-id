const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const envContent = `# Test JWT Keys (auto-generated, do not commit)
JWT_PRIVATE_KEY=${privateKey.replace(/\n/g, '\\n')}
JWT_PUBLIC_KEY=${publicKey.replace(/\n/g, '\\n')}
JWT_ISSUER=https://test.neome.uk
`;

fs.writeFileSync(path.join(__dirname, '../.env.test'), envContent);
console.log('Test keys generated in .env.test');
