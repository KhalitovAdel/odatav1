const yaml = require('js-yaml');
const fs = require('fs');
const axios = require('axios');
const { join } = require('path');
const { tmpdir } = require('os');

const { generate } = require('./sap');
const { propertiesParse, getAbsolutePath } = require('./utils');

async function run(path) {
    const rawConfig = fs.readFileSync(path, 'utf8');
    const config = yaml.load(rawConfig);
    const http = axios.create({});

    try {
        const { username, password } = getRcFileAuth();
        const base64 = Buffer.from(`${username}:${password}`).toString('base64');
        http.defaults.headers.common['Authorization'] = `Basic ${base64}`;
    } catch (e) {
        console.log(`Auth not exists`);
    }
    const generateTasks = config.generate || [];

    for (let i = 0; i < generateTasks.length; i++) {
        const { metadataUrl, destination } = generateTasks[i];
        const { data } = await http.get(metadataUrl, { responseType: 'blob' });
        const path = join(tmpdir(), `${i}`);
        fs.writeFileSync(path, data);
        generate(path, getAbsolutePath(destination));
    }
    
}

function getRcFileAuth() {
    const propertiesPath = process.env.GENERATOR_RC_PATH || '~/.sbercostrc';
    const map = propertiesParse(getAbsolutePath(propertiesPath));
    const username = map.get('alfa.dev.username');
    const password = map.get('alfa.dev.password');
    
    return { username, password };
}

module.exports = { run };