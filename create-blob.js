/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Read .env.local to get token
const envFile = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envFile, 'utf8');

// Try to extract BLOB_READ_WRITE_TOKEN if it exists
const tokenMatch = envContent.match(/BLOB_READ_WRITE_TOKEN=(.+)/);
if (tokenMatch && tokenMatch[1].trim()) {
  console.log('✓ Token already in .env.local:', tokenMatch[1].trim().substring(0, 20) + '...');
  process.exit(0);
}

// Load env vars from .env.local
const lines = envContent.split('\n');
const envVars = {};
lines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^"(.*)"$/, '$1');
    envVars[key] = value;
  }
});

// If not, we need to create it via API
const oidcToken = envVars.VERCEL_OIDC_TOKEN || process.env.VERCEL_OIDC_TOKEN;
if (!oidcToken) {
  console.error('❌ VERCEL_OIDC_TOKEN not found in .env.local or environment');
  process.exit(1);
}

// Try to create blob storage via Vercel API
const projectId = 'cam2verify';
const teamId = 'prepthetech';

async function createBlob() {
  try {
    const response = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/storage?teamId=${teamId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${oidcToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'blob',
          name: 'ggguard-media',
          access: 'private',
        }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.error?.message || response.statusText}`);
    }

    const token = data.token;
    if (!token) {
      throw new Error('No token returned from API');
    }

    console.log('✓ Blob storage created successfully!');
    console.log('Token:', token);

    // Update .env.local
    const updatedEnv = envContent + `\n# Vercel Blob Storage (created ${new Date().toISOString()})\nBLOB_READ_WRITE_TOKEN=${token}\n`;
    fs.writeFileSync(envFile, updatedEnv);
    console.log('✓ Token added to .env.local');

  } catch (error) {
    console.error('❌ Error creating blob:', error.message);
    process.exit(1);
  }
}

createBlob();
