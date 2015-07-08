# mlsound
Marklogic Software Development tool.

This projects aims to provide a fully functional javascript solution for deploying and bootstraping projects into Marklogic 8.

**Be warned!!** There are still a lot of things to be done before it can be considered stable/useful.

For now there is no npm package yet. To install it just execute the following command from project's root:
```
    $> npm install
    $> npm link
```

Once installed:

```
$> mlsound
mlsound version 0.0.1

  Usage: mlsound [options] [command]


  Commands:

    create [name]    Create project folder and scaffolding files
    bootstrap        Bootstrap project
    wipe             Wipe project
    deploy [module]  Deploy [code|data|schemas]
    clean [module]   Clean [code|data|schemas]
    restart          Restart server group
    help [cmd]       display help for [cmd]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```
