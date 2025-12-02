#!/usr/bin/env node
/**
 * Generate PNG icons from the SVG master icon
 * 
 * Usage: node scripts/generate-icons.mjs
 * 
 * This script generates:
 * - public/icons/apple-touch-icon.png (180x180)
 * - public/icons/icon-192.png (192x192)
 * - public/icons/icon-512.png (512x512)
 * - public/apple-touch-icon.png (180x180, copy for root access)
 * - public/icon.png (32x32, favicon fallback)
 */

import sharp from 'sharp';
import { readFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const masterSvgPath = join(projectRoot, 'public', 'icon-master.svg');
const faviconSvgPath = join(projectRoot, 'public', 'icon.svg');
const iconsDir = join(projectRoot, 'public', 'icons');

// Read the SVG files
const masterSvgBuffer = readFileSync(masterSvgPath);
const faviconSvgBuffer = readFileSync(faviconSvgPath);

async function generateIcons() {
  console.log('Generating icons from SVG master...\n');

  // Generate 180x180 Apple Touch Icon
  await sharp(masterSvgBuffer)
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(join(iconsDir, 'apple-touch-icon.png'));
  console.log('✓ Generated apple-touch-icon.png (180x180)');

  // Generate 192x192 PWA icon
  await sharp(masterSvgBuffer)
    .resize(192, 192)
    .png({ quality: 100 })
    .toFile(join(iconsDir, 'icon-192.png'));
  console.log('✓ Generated icon-192.png (192x192)');

  // Generate 512x512 PWA icon
  await sharp(masterSvgBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(join(iconsDir, 'icon-512.png'));
  console.log('✓ Generated icon-512.png (512x512)');

  // Generate 32x32 favicon PNG fallback from the favicon SVG (transparent background)
  await sharp(faviconSvgBuffer)
    .resize(32, 32)
    .png({ quality: 100 })
    .toFile(join(projectRoot, 'public', 'icon.png'));
  console.log('✓ Generated icon.png (32x32)');

  // Copy apple-touch-icon to root public folder for compatibility
  copyFileSync(
    join(iconsDir, 'apple-touch-icon.png'),
    join(projectRoot, 'public', 'apple-touch-icon.png')
  );
  console.log('✓ Copied apple-touch-icon.png to public/ root');

  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(console.error);

