# mlsound
Marklogic Software Development tool.

This projects aims to provide a fully functional javascript solution for deploying and bootstraping projects into Marklogic 8.

**Be warned!!** Although is already quite useful, the project is still under development.

To install it just execute the following command :
```
    $> npm install mlsound
```

Once installed:

```
$> mlsound
mlsound version 0.0.1

  Usage: mlsound [options] [command]


  Commands:

    create [name]    Create project folder and scaffolding files
    add [module]     Add configuration files for [cpf|triggers|mimetypes]
    bootstrap        Bootstrap project
    wipe             Wipe project
    deploy [module]  Deploy [code|data|schemas|triggers|cpf|alerts]
    clean [module]   Clean [code|data|schemas]
    restart          Restart server group
    help [cmd]       display help for [cmd]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

To create a custom command have a look at the included ./bin/mlsound-custom.js.
You can create more commands adding them to the ./bin folder following the naming convention "./bin/mlsound-<command>.js"
