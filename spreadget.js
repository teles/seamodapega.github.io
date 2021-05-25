#!/usr/bin/env node
const { hideBin } = require('yargs/helpers');
const update = require('./src/update');

const argv = require('yargs/yargs')(hideBin(process.argv))
    .command(
        'update [spreadsheet]',
        'Updates local files based on Google Spreadsheet data',
        function (yargs) {
            return yargs.option('spreadsheet', {
                alias: 's',
                type: 'string',
                describe: 'Google Spreadsheet id'
            }).option('sheet', {
                alias: 'n',
                default: 1,
                type: 'number',
                describe: 'Google Spreadsheet sheet number'
            }).option('output-dir', {
                alias: 'd',
                type: 'string',
                describe: 'Output directory for files',
                default: './_posts'
            }).option('force-update', {
                alias: 'f',
                type: 'boolean',
                describe: 'Forces update regardless of versions',
                default: false
            }).option('verbose', {
                alias: 'v',
                type: 'boolean',
                description: 'Run with verbose logging'
            })
        }
    )
    .demand(['spreadsheet'])
    .help('h')
    .example('$0 update -s 1hDR2paRr6BxX9LDzSZEmA__Y3byrUgtOOGz9BFC-sVg -n 2 -f')
    .argv;

update(argv.spreadsheet, {
    sheetNumber: argv.sheet,
    shouldForceUpdate: argv.forceUpdate,
    outputDir: argv.outputDir,
    isVerbose: argv.verbose
}).then(message => {
    console.info(message);
});
