/**
 * create-theme-images.js - Generate theme preview images
 * Run with: node create-theme-images.js
 */

const fs = require('fs');
const path = require('path');

// Create directories if they don't exist
const imagesDir = path.join(__dirname, 'public', 'assets', 'images', 'theme-previews');

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log('Created theme-previews directory');
}

// For now, create placeholder files - you'll need to replace these with actual screenshots
const themes = ['default', 'dark', 'minimal', 'dense'];

themes.forEach(theme => {
  const filePath = path.join(imagesDir, `${theme}.png`);
  
  if (!fs.existsSync(filePath)) {
    // Create a simple placeholder file
    const placeholderContent = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0xC8, 0x00, 0x00, 0x00, 0x96, // 200x150 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x4F, 0x15, 0x4A, // bit depth, color type, etc.
      0x26, // IHDR CRC
      // Add minimal PNG data for 200x150 colored rectangle
      0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk start
      0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // minimal compressed data
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82 // IEND
    ]);
    
    fs.writeFileSync(filePath, placeholderContent);
    console.log(`Created placeholder for ${theme}.png`);
  } else {
    console.log(`${theme}.png already exists`);
  }
});

console.log('\nTo create proper theme preview images:');
console.log('1. Open theme-preview-generator.html in your browser');
console.log('2. Take screenshots of each theme preview');
console.log('3. Save as PNG files (200x150 pixels) in public/assets/images/theme-previews/');
console.log('4. Or use a tool like Puppeteer to automate screenshot generation');

// Create an npm script to generate proper screenshots with Puppeteer (optional)
const puppeteerScript = `
// Optional: Install puppeteer and use this script
const puppeteer = require('puppeteer');
const fs = require('fs');

async function generateThemeImages() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto('file://' + __dirname + '/public/assets/theme-preview-generator.html');
  
  const themes = ['default', 'dark', 'minimal', 'dense'];
  
  for (const theme of themes) {
    const element = await page.$('#preview-' + theme);
    const screenshot = await element.screenshot({ type: 'png' });
    
    fs.writeFileSync('public/assets/images/theme-previews/' + theme + '.png', screenshot);
    console.log('Generated ' + theme + '.png');
  }
  
  await browser.close();
}

generateThemeImages().catch(console.error);
`;

fs.writeFileSync(path.join(__dirname, 'generate-screenshots.js'), puppeteerScript);
console.log('\nOptional Puppeteer script created: generate-screenshots.js');
console.log('Run: npm install puppeteer && node generate-screenshots.js');
