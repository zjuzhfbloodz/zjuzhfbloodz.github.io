const fs = require('fs');
const path = require('path');

const dataPath = '/Users/bloodz/Documents/macmini/service/bloodzSpace/source/pets/images-data.js';
const content = fs.readFileSync(dataPath, 'utf8');

// Extract JSON by evaluating the file
const petImagesData = eval('(' + content.replace(/^const petImagesData = /, '').replace(/;$/, '') + ')');

// New image entry
const newEntry = {
  date: "2026-03-22",
  time: "04:00",
  img: "/images/pets/20260322-040020-BD0673744.jpg",
  type: "other",
  found: false,
  boxedImg: "/images/pets/annotated/20260322-040020-BD0673744.jpg",
  analysis: "image: 图片模糊，未发现明显的人/猫/狗；YOLO:无检测(person/cat/dog)",
  petIdentity: null,
  yoloClasses: [],
  decisionSource: "both"
};

// Add to the beginning of 2026-03-22 array
petImagesData.images["2026-03-22"].unshift(newEntry);

// Calculate stats
const allImages = Object.values(petImagesData.images).flat();
const stats = {
  totalImages: allImages.length,
  personCount: allImages.filter(i => i.type === 'person').length,
  catCount: allImages.filter(i => i.type === 'cat').length,
  dogCount: allImages.filter(i => i.type === 'dog').length
};

console.log('Stats:', JSON.stringify(stats));

// Write back
const output = 'const petImagesData = ' + JSON.stringify(petImagesData, null, 2) + ';\n\nmodule.exports = petImagesData;';
fs.writeFileSync(dataPath, output);
console.log('Updated successfully');
