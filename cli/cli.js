#! /usr/bin/env node  

const { Command } = require('commander');
const { getAbsolutePath } = require('./utils');

const { generate } = require('./sap');
const { run } = require('./run');

const { version } = require('../package.json');
const program = new Command();

program
  .name('generate entity')
  .description('Generate entity from specification')
  .version(version);

program.command('g')
  .description('Generate entity from specification')
  .requiredOption('-sp, --spec-path <string>', 'path to specification')
  .requiredOption('-o, --output-folder <string>', 'Destination folder')
  .action((opts, s) => {
    generate(getAbsolutePath(opts.specPath), getAbsolutePath(opts.outputFolder));
  });

program.command('run')
  .description('Generate entity from config file')
  .requiredOption('-c, --config <string>', 'path to config')
  .action((opts, s) => {
    run(getAbsolutePath(opts.config));
  });

program.parse();
