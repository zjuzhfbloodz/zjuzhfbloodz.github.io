const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'images-data.js');
let content = fs.readFileSync(filePath, 'utf8');

// Extract JSON from the JS file
const jsonMatch = content.match(/^const petImagesData = (.+);$/s);
if (!jsonMatch) {
  console.error('Failed to parse JS file');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(jsonMatch[1]);
} catch (e) {
  console.error('JSON parse error:', e.message);
  process.exit(1);
}

// New image entry
const newImage = {
  date: '2026-03-23',
  time: '09:30',
  img: '/images/pets/20260323-093000-BD0673744.jpg',
  type: 'other',
  found: false,
  boxedImg: null,
  analysis: '图片模糊，无法明确识别出人、猫、狗或其他动物。YOLO未检测到任何目标。',
  petIdentity: null,
  yoloClasses: [],
  decisionSource: 'both'
};

// Add date if not exists
if (!data.dates.includes('2026-03-23')) {
  data.dates.unshift('2026-03-23');
  data.images['2026-03-23'] = [];
}
// Add image to beginning of array
data.images['2026-03-23'].unshift(newImage);

// Recalculate stats
const totalImages = Object.values(data.images).reduce((sum, arr) => sum + arr.length, 0);
const personCount = Object.values(data.images).reduce((sum, arr) => sum + arr.filter(i => i.type === 'person').length, 0);
const catCount = Object.values(data.images).reduce((sum, arr) => sum + arr.filter(i => i.type === 'cat').length, 0);
const dogCount = Object.values(data.images).reduce((sum, arr) => sum + arr.filter(i => i.type === 'dog').length, 0);

// Write back
const output = 'const petImagesData = ' + JSON.stringify(data, null, 2) + ';\nmodule.exports = petImagesData;';
fs.writeFileSync(filePath, output);

console.log('Updated. Stats:', { totalImages, personCount, catCount, dogCount });