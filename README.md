# wild-config

Opinionated configuration management module for Node.js daemon applications.

- Config files use either [toml](https://github.com/toml-lang/toml), JSON or JavaScript syntax
- If the config file format is JavaScript, then the value must be exported with "module.exports = {...}"
- The application can have a config file for default values in ./config/default.toml
- Main config file path can be provided from a command line argument, eg. `--config=/etc/app.toml`
- Additionally command line arguments can be used to override any existing config option
- _wild-config_ detects SIGHUP and reloads configuration files automatically

## Loading order

_wild-config_ tries to load configuration in the following order (missing files are skipped, except the one provided by `--config` argument). Values are merged.

1. ./config/default.*
2. ./config/$NODE_ENV.*
3. `--config` or `-c` argument value
4. command line arguments

> If you want to use a different configuration directory than './config' for default configuration files, then set it with the `NODE_CONFIG_DIR` environment variable

### Command line arguments

When using command line arguments to provide config values only such keys are merged that already exist in the configuration object, unknown keys are ignored. For subkeys use dot notation. Value type (numbers, booleans and strings are supported) is defined by existing value.

Example _config/default.toml_:

```toml
[server]
enabled=false
```

Override `server.enabled` value with the following command line argument:

```
node app.js --server.enabled=true
```

`server.enabled` is defined as a boolean in the config file, so the overriden value is also going to be `true` as a boolean and not `"true"` as a string.

## TOML extensions

wild-config toml includes additional options when working with toml

### Including child files

Use the following syntax to include an additional config file in the place of the directive

```toml
# @include "/path/to/sub/config.toml"
```

This directive also works in a nested object

```toml
[nested]
    # @include "/path/to/sub/config.toml"
```

**Notes**

- Included paths are resolved relative to the path of the configuration file where the include directive is used
- Included config files do not have to be toml files, any other supported format works as well
- If the included config file is a toml file then it can have its own includes
- If the config file returns an array then the array value will become the value of the parent key of the directive only if there are no other subkeys at the same level as the directive

## Application config file

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

_wild-config_ catches SIGHUP signal and reloads configuration files. Additionally a 'reload' event is emitted.

```javascript
const config = require('wild-config');
config.on('reload', ()=>{
    console.log('New "server.enabled" value: %s', config.server.enabled);
});
```

### Events

- _'reload'_ emitted when SIGHUP is received and configuration is reloaded

### Limitations

- You can not use "on" as a root key. If you do then it is ignored. This key is reserved for the event emitter handler.
- When providing configuration options from command line then `--config` does not override `root.config` value (if it even exists). This argument is used only for defining the configuration file path.

## Licese

**MIT**
