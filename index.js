/* eslint no-console: 0, global-require: 0 */
'use strict';

if (process.env.DISABLE_WILD_CONFIG === 'true') {
    return;
}

const EventEmitter = require('events');
const env =
    (process.env.NODE_ENV || '')
        .toString()
        .toLowerCase()
        .replace(/[^0-9a-z-_]/g, '') || 'development';
const fs = require('fs');
const glob = require('glob');
const toml = require('toml');
const path = require('path');
const deepExtend = require('deep-extend');
const configDirectory = process.env.NODE_CONFIG_DIR || path.join(process.cwd(), 'config');
const events = new EventEmitter();
const vm = require('vm');

const argv = require('minimist')(process.argv.slice(2));
const configPath = process.env.NODE_CONFIG_PATH || argv.config || false;

events.setMaxListeners(0);

module.exports = {
    configDirectory
};

let loadConfig = skipEvent => {
    let sources = [{}];

    function extendToml(basePath, contents) {
        // # @include "/path/to/toml"
        let c = 0;
        return contents.replace(/^\s*#\s*@include\s*"([^"]+)"/gim, (m, p) => {
            if (!path.isAbsolute(p)) {
                p = path.join(basePath, p);
            }
            p = p.replace(/\{ENV\}/gi, env);
            let res = m;
            try {
                let files;
                if (p.indexOf('*') >= 0) {
                    files = glob.sync(p);
                } else {
                    files = [p];
                }

                files.forEach(file => {
                    let stat = fs.statSync(file);

                    if (!stat.isFile()) {
                        throw new Error(file + ' is not a file');
                    }
                });
                res = '__include_file_path_' + ++c + '=' + JSON.stringify(files);
            } catch (E) {
                throw E;
            }
            return res;
        });
    }

    function parseFile(filePath) {
        let pathParts = path.parse(filePath);
        let ext = pathParts.ext.toLowerCase();
        let basePath = pathParts.dir;
        let parsed;
        try {
            let contents = fs.readFileSync(filePath, 'utf-8');

            switch (ext) {
                case '.js': {
                    let script = new vm.Script(contents);
                    const sandbox = {
                        require,
                        __dirname: basePath,
                        __filename: filePath,
                        module: {
                            exports: {}
                        },
                        process
                    };
                    script.runInNewContext(sandbox);
                    parsed = sandbox.module.exports;
                    break;
                }
                case '.toml':
                    parsed = tomlParser(basePath, contents);
                    break;
                case '.json':
                    parsed = JSON.parse(contents);
                    break;
            }
        } catch (E) {
            E.message = filePath + ': ' + E.message;
            throw E;
        }
        return parsed;
    }

    function tomlParser(basePath, contents) {
        let parsed = toml.parse(extendToml(basePath, contents));
        // find includes
        let walk = (node, parentNode, nodeKey, level) => {
            if (level > 100) {
                throw new Error('Too much nesting in configuration file');
            }

            if (Array.isArray(node)) {
                node.forEach(entry => walk(entry, node, false, level + 1));
            } else if (node && typeof node === 'object') {
                Object.keys(node || {}).forEach(key => {
                    if (/^__include_file_path_\d+$/.test(key) && Array.isArray(node[key])) {
                        let filePaths = node[key];
                        delete node[key];
                        filePaths.forEach(filePath => {
                            let parsed = parseFile(filePath);
                            if (Array.isArray(parsed)) {
                                if (parentNode && nodeKey && Object.keys(node).length === 0) {
                                    parentNode[nodeKey] = parsed;
                                }
                            } else {
                                Object.keys(parsed || {}).forEach(subKey => {
                                    node[subKey] = parsed[subKey];
                                });
                            }
                        });
                    } else if (node[key] && typeof node[key] === 'object') {
                        walk(node[key], node, key, level + 1);
                    }
                });
            }
        };

        walk(parsed, false, false, 0);

        return parsed;
    }

    let loadFromFile = (filePath, ignoreMissing) => {
        if (!filePath) {
            // do nothing
            return;
        }
        try {
            let parsed = parseFile(filePath);
            if (parsed) {
                sources.push(parsed);
            }
        } catch (E) {
            if (E.code !== 'ENOENT' || !ignoreMissing) {
                // file missing, ignore
                console.error('[' + filePath + '] ' + E.message);
                process.exit(1);
            }
        }
    };

    try {
        let listing = fs.readdirSync(configDirectory);
        listing
            .map(file => ({
                name: file,
                isDefault: file.toLowerCase().indexOf('default.') === 0,
                path: path.join(configDirectory, file)
            }))
            .filter(file => {
                let parts = path.parse(file.name);
                if (!['.toml', '.json', '.js'].includes(parts.ext.toLowerCase())) {
                    return false;
                }
                if (!['default', env].includes(parts.name.toLowerCase())) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (a.isDefault) {
                    return -1;
                }
                if (b.isDefault) {
                    return 1;
                }
                return a.path.localeCompare(b.path);
            })
            .forEach(file => loadFromFile(file.path));
    } catch (E) {
        // failed to list files
    }

    // try user specified file
    loadFromFile(configPath);

    // join found files
    let data = deepExtend(...sources);

    delete argv._;
    delete argv.config;

    let walkConfig = (cParent, eParent) => {
        Object.keys(eParent || {}).forEach(key => {
            if (!(key in cParent)) {
                return;
            }

            if (typeof cParent[key] === 'object') {
                if (!cParent[key]) {
                    // null
                    return;
                }
                if (eParent[key] === 'object') {
                    if (!eParent[key]) {
                        // null
                        return;
                    }
                    if (Array.isArray(cParent[key])) {
                        if (Array.isArray(eParent[key])) {
                            return;
                        }
                        // convert to array
                        eParent[key] = eParent[key].trim().split(/\s*,\s*/);
                        return;
                    }
                    return walkConfig(cParent[key], eParent[key]);
                }
            }

            let value = eParent[key];

            if (typeof cParent[key] === 'number') {
                eParent[key] = Number(eParent[key]);
            } else if (typeof cParent[key] === 'boolean') {
                if (!isNaN(value)) {
                    value = Number(value);
                } else {
                    value = value.toLowerCase();
                }
                let falsy = ['false', 'null', 'undefined', 'no', '0', '', 0];
                eParent[key] = falsy.includes(value) ? false : !!value;
            }
        });
    };

    if (Object.keys(argv || {}).length) {
        walkConfig(data, argv);
        data = deepExtend(data, argv);
    }

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
