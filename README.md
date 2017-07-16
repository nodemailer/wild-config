# wild-config

Opinionated configuration management module for Node.js daemon applications.

*wild-config* loads configuration from application config directory and from a config path if provided. All configuration files use [toml](https://github.com/toml-lang/toml) syntax.

### Loading order

*wild-config* tries to load configuration in the following order (missing files are skipped, except the one provided by --config argument). Values are merged.

1. ./config/default.toml
2. ./config/$NODE_ENV.toml
3. `--config` or `-c` argument value
4. command line arguments

#### Command line arguments

In case of command line arguments only such keys are merged that already exist in the configuration object. For subkeys use dot notation. Value type (numbers, booleans and strings are supported) is defined by existing value.

Example default.toml

```toml
[server]
enabled=false
```

Override server.enabled with the following command line:

    node app.js --server.enabled=true

#### Application config file

If you are running your app as a service daemon, then you can load configuration from a config file from a common config folder, eg. /etc by using the ``--config` argument. These values are loaded and merged with the default values.

```
[Service]
WorkingDirectory=/opt/application
ExecStart=/usr/bin/node index.js --config=/etc/app.toml
```

## Usage

```javascript
const config = require('wild-config');

console.log(config.server.enabled); // false
```

### Configuration reload

*wild-config* catches SIGHUP signal and reloads configuration files. Additionally a 'reload' event is emitted.

```javascript
const config = require('wild-config');
config.on('reload', ()=>{
    console.log('Configuration was updated');
    console.log('New "server.enabled" value: %s', config.server.enabled);
});
```

### Events

* *'reload'* emitted when SIGHUP is received

### Limitations

* You can not use "on" as a root key. If you do then it is ignored. This key is reserved for the event emitter handler.

## Licese

**MIT**
