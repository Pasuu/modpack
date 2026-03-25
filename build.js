const fs = require('fs');
const path = require('path');

const modpacksDir = './modpacks';
const outputFile = './public/modpacks.json';

const combined = {};

fs.readdirSync(modpacksDir).forEach(file => {
  if (path.extname(file) === '.json' && file !== 'index.json') {
    const filePath = path.join(modpacksDir, file);
    const modpackData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const modpackName = file
      .replace('.json', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    
    combined[modpackName] = modpackData;
  }
});

fs.writeFileSync(outputFile, JSON.stringify(combined, null, 2));
console.log(`已生成 ${outputFile}，包含 ${Object.keys(combined).length} 个整合包`);