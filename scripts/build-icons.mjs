import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const assets = [
    ['ivice-mobile', 1024],
    ['ivice-web', 128],
    ['ivice-favicon', 32]
];

for (const [name, size] of assets) {
    const input = new URL(`../src/${name}.svg`, import.meta.url);
    const output = new URL(`../src/${name}.png`, import.meta.url);
    await sharp(fileURLToPath(input)).resize(size, size).png().toFile(fileURLToPath(output));
    console.log(`${name}.png: ${size} x ${size}`);
}