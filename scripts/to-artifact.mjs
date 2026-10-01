/*
 * Turns the single-file Vite build into a Claude Artifact page.
 *
 * The Artifact publisher wraps the page in its own <!doctype><html><head><body>
 * skeleton, so this script strips those tags, inlines the StyleX stylesheet,
 * and writes dist-artifact/workfile.html with <title> first (the publisher
 * reads the title from the first 8KB).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-artifact';
let html = readFileSync(join(dir, 'index.html'), 'utf8');

const stylexPath = join(dir, 'assets', 'stylex.css');
const stylexCss = existsSync(stylexPath) ? readFileSync(stylexPath, 'utf8') : '';

const title = (html.match(/<title>[\s\S]*?<\/title>/) ?? ['<title>Workfile</title>'])[0];
const links = html.match(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g) ?? [];
const styles = html.match(/<style[^>]*>[\s\S]*?<\/style>/g) ?? [];
const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) ?? [];
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) ?? ['', ''])[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();

const out = [
  title,
  ...links,
  ...styles,
  stylexCss ? `<style>${stylexCss}</style>` : '',
  body,
  ...scripts,
]
  .filter(Boolean)
  .join('\n');

writeFileSync(join(dir, 'workfile.html'), out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log(`Artifact page written: ${dir}/workfile.html (${kb} KB, StyleX CSS ${stylexCss ? 'inlined' : 'missing!'})`);
