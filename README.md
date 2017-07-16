# wild-config

Opinionated configuration management module for Node.js daemon applications.

* All config files use [toml](https://github.com/toml-lang/toml) syntax
* The application can have a config file for default values in ./config/default.toml
* Main config file path can be provided from a command line argument, eg. `--config=/etc/app.toml`
* Additionally command line arguments can be used to override any existing config option
* *wild-config* detects SIGHUP and reloads configuration files automatically

### Loading order

*wild-config* tries to load configuration in the following order (missing files are skipped, except the one provided by `--config` argument). Values are merged.

1. ./config/default.toml
2. ./config/$NODE_ENV.toml
3. `--config` or `-c` argument value
4. command line arguments

#### Command line arguments

When using command line arguments to provide config values only such keys are merged that already exist in the configuration object, unknown keys are ignored. For subkeys use dot notation. Value type (numbers, booleans and strings are supported) is defined by existing value.

Example *config/default.toml*:

```toml
[server]
enabled=false
```

Override `server.enabled` value with the following command line argument:

    node app.js --server.enabled=true

`server.enabled` is defined as a boolean in the config file, so the overriden value is also going to be `true` as a boolean and not `"true"` as a string.

#### Application config file

If you are running your app as a service daemon, then you can load configuration from a config file by using the `--config` argument. These values are loaded and merged with the default values.

```
[Service]
WorkingDirectory=/opt/app
ExecStart=/usr/bin/node index.js --config=/etc/app.toml
```

## Usage

```javascript
const config = require('wild-config');
console.log(config.server.enabled);
```

### Configuration reload

*wild-config* catches SIGHUP signal and reloads configuration files. Additionally a 'reload' event is emitted.

```javascript
const config = require('wild-config');
config.on('reload', ()=>{
    console.log('New "server.enabled" value: %s', config.server.enabled);
});
```

### Events

* *'reload'* emitted when SIGHUP is received and configuration is reloaded

### Limitations

* You can not use "on" as a root key. If you do then it is ignored. This key is reserved for the event emitter handler.
* When providing configuration options from command line then `--config` does not override `root.config` value (if it even exists). This argument is used only for defining the configuration file path.

## Licese

**MIT**