const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Match transform: 'translateY(...)' or transform: translateY(...) in JS and CSS
  // Also remove it completely from object literals if it leaves trailing commas
  const newContent = content
    .replace(/\s*transform:\s*['"]?translateY\([^)]+\)['"]?,?/g, '')
    // Also remove transform: translateY(0) in _active
    .replace(/\s*transform:\s*['"]?translateY\(0\)['"]?,?/g, '');
    
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedCount++;
    console.log('Updated', file);
  }
});
console.log('Total files updated:', changedCount);
