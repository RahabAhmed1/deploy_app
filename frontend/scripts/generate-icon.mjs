import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');

const target = path.join(publicDir, 'icon.png');
const preferred = path.join(publicDir, 'icon-source.png');
const fallbackPng = path.join(publicDir, 'favicon.png');
const fallbackSvg = path.join(publicDir, 'placeholder.svg');

async function ensureIcon() {
  // If an icon.png already exists and is >=256x256, keep it
  if (fs.existsSync(target)) {
    try {
      const meta = await sharp(target).metadata();
      if ((meta.width || 0) >= 256 && (meta.height || 0) >= 256) {
        console.log(`[icon] Using existing ${path.relative(root, target)} (${meta.width}x${meta.height})`);
        return;
      }
    } catch {}
  }

  let source = null;
  if (fs.existsSync(preferred)) source = preferred;
  else if (fs.existsSync(fallbackPng)) source = fallbackPng;
  else if (fs.existsSync(fallbackSvg)) source = fallbackSvg;

  if (!source) {
    console.warn('[icon] No source image found. Expected one of: public/icon-source.png, public/favicon.png, public/placeholder.svg');
    return;
  }

  try {
    const img = sharp(source);
    const png = await img
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(target, png);
    console.log(`[icon] Generated ${path.relative(root, target)} from ${path.relative(root, source)}`);
  } catch (e) {
    console.error('[icon] Failed to generate icon:', e);
  }
}

ensureIcon();
