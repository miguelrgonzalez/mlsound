# mlsound
Marklogic Software Development tool.

This projects aims to provide a fully functional javascript solution for deploying and bootstraping projects into Marklogic 8.

**Be warned!!** Although is already quite useful, the project is still under development.

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
    add [module]     Add configuration files for [cpf|triggers|mimetypes]
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
