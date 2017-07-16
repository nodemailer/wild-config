/* eslint no-console: 0 */
'use strict';

const EventEmitter = require('events');
const env = (process.env.NODE_ENV || '').toString().toLowerCase().replace(/[^0-9a-z-_]/g, '') || 'development';
const fs = require('fs');
const toml = require('toml');
const path = require('path');
const deepExtend = require('deep-extend');
const defaultPath = path.join(process.cwd(), 'config', 'default.toml');
const envPath = path.join(process.cwd(), 'config', env + '.toml');
const events = new EventEmitter();

const argv = require('minimist')(process.argv.slice(2));
const configPath = argv.config || argv.c;

module.exports = {};

let loadConfig = skipEvent => {
    let sources = [{}];

    let loadFromFile = (filePath, ignoreMissing) => {
        if (!filePath) {
            // do nothing
            return;
        }
        try {
            let stat = fs.statSync(filePath);
            if (!stat.isFile()) {
                throw new Error('path is not a file');
            }
            sources.push(toml.parse(fs.readFileSync(filePath, 'utf-8')));
        } catch (E) {
            if (E.code !== 'ENOENT' || !ignoreMissing) {
                // file missing, ignore
                console.error(filePath + ': ' + E.message);
                process.exit(1);
            }
        }
    };

    loadFromFile(defaultPath, true);
    loadFromFile(envPath, true);
    loadFromFile(configPath);

    let data = deepExtend(...sources);

    // apply command line options
    // only modifies keys that already exist
    Object.keys(argv).forEach(key => {
        if (key === '_' || key === 'config' || key === 'c') {
            return;
        }
        let value = argv[key];
        let kPath = key.replace(/\.+/g, '.').replace(/^\.|\.$/g, '').trim().split('.');

        let ignore = false;
        let parent = data;
        let eKey = kPath.pop();
        kPath.forEach(k => {
            if (ignore) {
                return;
            }
            if (parent[k] && typeof parent[k] === 'object' && !Array.isArray(parent[k])) {
                parent = parent[k];
            }
        });
        if (ignore) {
            return;
        }
        if (eKey in parent) {
            if (typeof parent[eKey] === 'number' && !isNaN(value)) {
                parent[eKey] = Number(value);
            } else if (typeof parent[eKey] === 'boolean') {
                if (!isNaN(value)) {
                    value = Number(value);
                } else {
                    value = value.toLowerCase();
                }
                let falsy = ['false', 'null', 'undefined', 'no', '0', '', 0];
                parent[eKey] = falsy.includes(value) ? false : !!value;
            } else {
                parent[eKey] = value;
            }
        }
    });

    Object.keys(data).forEach(key => {
        if (key !== 'on') {
            module.exports[key] = data[key];
        }
    });

    if (!skipEvent) {
        events.emit('reload');
    }
};
events.reload = loadConfig;

Object.defineProperty(module.exports, 'on', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: (...args) => events.on(...args)
});

process.on('SIGHUP', () => {
    setImmediate(loadConfig);
});

loadConfig(true);
