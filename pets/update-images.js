const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'images-data.js');
let content = fs.readFileSync(filePath, 'utf8');

// Extract the JSON part
const match = content.match(/const petImagesData = ({[\s\S]*?})(;|\s*$)/);
if (!match) {
  console.error('Could not parse petImagesData');
  process.exit(1);
}

const jsonStr = match[1];
const data = eval('(' + jsonStr + ')');

const newEntry = {
  date: '2026-03-09',
  time: '01:00',
  img: '/images/pets/20260309-010000-BD0673744.jpg',
  type: 'other',
  boxedImg: '/images/pets/annotated/20260309-010000-BD0673744.jpg',
  analysis: 'image视觉识别和YOLO目标检测均未检测到人/猫/狗。图片模糊，整体呈灰白色调，无法识别具体内容。',
  petIdentity: null,
  yoloClasses: [],
  decisionSource: 'both'
};

// Add to 2026-03-09 array
if (!data.images['2026-03-09']) {
  data.images['2026-03-09'] = [];
}
data.images['2026-03-09'].unshift(newEntry);

// Recalculate stats
let personCount = 0, catCount = 0, dogCount = 0;
Object.values(data.images).forEach(arr => {
  arr.forEach(img => {
    if (img.type === 'person') personCount++;
    else if (img.type === 'cat') catCount++;
    else if (img.type === 'dog') dogCount++;
  });
});

data.stats = {
  totalImages: Object.values(data.images).reduce((sum, arr) => sum + arr.length, 0),
  personCount,
  catCount,
  dogCount
};

const newContent = 'const petImagesData = ' + JSON.stringify(data, null, 2) + ';';
fs.writeFileSync(filePath, newContent);

console.log('Updated successfully!');
console.log('Stats:', JSON.stringify(data.stats));
console.log('Entry count for 2026-03-09:', data.images['2026-03-09'].length);
