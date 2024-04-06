const path = require('path');
const fs = require('fs');

function getAbsolutePath(relativePath) {
  if (relativePath.startsWith('~/')) {
    return path.join(process.env.HOME, relativePath.slice(2));
  }

  return path.resolve(process.cwd(), relativePath);
}

function propertiesParse(path) {
  const result = new Map();
  const raw = fs.readFileSync(path, 'utf8');
  raw.split('\n').forEach(el => {
    const [key, ...value] = el.split('=');
    result.set(key.trim(), value.join('=').trim());
  });
  return result;
}


module.exports = {
    getAbsolutePath,
    propertiesParse,
};