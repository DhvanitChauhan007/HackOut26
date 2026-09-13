import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Running Vercel monorepo build...');

// 1. Ensure dependencies are installed in frontend_design
if (!fs.existsSync(path.join(process.cwd(), 'frontend_design', 'node_modules'))) {
  console.log('📦 Installing frontend dependencies...');
  execSync('npm --prefix frontend_design install', { stdio: 'inherit' });
}

// 2. Run build with NITRO_PRESET=vercel
console.log('⚡ Building frontend with NITRO_PRESET=vercel...');
execSync('npm --prefix frontend_design run build', {
  stdio: 'inherit',
  env: { ...process.env, NITRO_PRESET: 'vercel' },
});

// 3. Move .vercel/output to the repository root so Vercel finds it
const srcVercel = path.join(process.cwd(), 'frontend_design', '.vercel');
const destVercel = path.join(process.cwd(), '.vercel');

if (fs.existsSync(srcVercel)) {
  console.log('📂 Linking .vercel output to repository root...');
  fs.cpSync(srcVercel, destVercel, { recursive: true, force: true });
  console.log('✅ Successfully linked .vercel output to root!');
} else {
  console.warn('⚠️ Warning: frontend_design/.vercel was not found');
}
