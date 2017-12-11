# service
The service side of clearlydefined.io

## Endpoints
### Resolved
#### GET /components/:packageFormat/:origin/:packageName/:packageVersion



### Curation
#### PATCH /curations/:packageFormat/:origin/:packageName/:packageVersion

##### Request Body
{
  "copyright": "",
  "license_expression": "",
  "vcs_url": ""
}

##### Description
As a PATCH you only need to provide the attributes you want to add or update, any attributes not included will be ignored. To explicitly remove an attribute set its value to `null`.

TODO: Make sure the attribute names are consistent with AboutCode/ScanCode
TODO: Include a section where the author's identity and reasoning is provided

### Harvested
TODO

## Storage
### Curation
Curation patches will be stored in:
https://github.com/clearlydefined/curated-data

#### Structure
```
packageFormat
  origin
    packageName.yaml
```

Note that the package name may contain a namespace portion, if it does, then the namespace will become a directory under origin and the packageName.yaml will be stored in the namespace directory.

#### Format
TODO

### Harvested
Harvested data will be stored in:
https://github.com/clearlydefined/harvested-data

This location is temporary, as harvested data grows will likely need to move it out of GitHub to scale.

#### Structure
```
packageFormat
  origin
    packageName
      packageVersion
        toolName
          [tool output files]
```

#### Format
The format of harvested data is tool-specific. Tool output is stored in the tool's native output format. If there is a choice between multiple output formats then the priorities are:
1. Machine-readable
1. Lossless
1. JSON

## Package Format Registry
* git
* maven
* npm
* nuget
* rubygem

## Origin Registry
* central.maven.org
* github.com
* npmjs.org
* nuget.org

## Tool Name Registry
* ScanCode
* Fossology

## TODO
* Swagger to replace most of this doc
* Complete registries