# ClearlyDefined service

This is the service side of clearlydefined.io. The service mainly manages curations, human inputs and corrections, of harvested data. The [ClearlyDefined crawler](https://github.com/clearlydefined/crawler) does the bulk of the harvesting so here we manage the open source/crowd-sourced part of ClearlyDefined. Users come together to add data, review data, and propose upstream changes to clarify the state of a project.

Like other open source projects, ClearlyDefined works with contributions coming as pull requests on a GitHub repo. In our case, curations data changes and are contributed to the [ClearlyDefined curated-data](https://github.com/clearlydefined/curated-data) repo. Those PRs are reviewed, discussed and ultimately merged into the curation repo. From there this service _builds_ a database that further merges automatically harvested data with the newly curated data and makes it available via REST APIs.

In effect the curated data for a project is a _fork_ of the project. Like most forks, we don't want to maintain changes as they quickly rot and need constant care and attention. Besides, the stated goal of ClearlyDefined is to help projects become more successful through clear data about the projects. The best way to do that is work with the upstream projects to include the data directly in projects themselves.

# Quick start

Unless of course you are working on it, you should not need to run this service yourself. Rather, you can use
https://dev-api.clearlydefined.io for experimental work or https://api.clearlydefined.io for working with
production data.

If you do want to run the service locally, follow these steps.

## Fastest Set Up

The quickest way to get a fully functional local ClearlyDefined set up (including the service) is to use the [Dockerized ClearlyDefined environment setup](https://github.com/clearlydefined/docker_dev_env_experiment). This runs all services locally and does not require access to the ClearlyDefined Azure account.

## Alternative Set Up

Some parts of this set up may require access to the ClearlyDefined Azure Account.

1. Clone this repo
1. Copy the `minimal.env.json` file to the **parent** directory of the repo and rename it to `env.json` and set any property values you need. See below for simple, local setup and the [Configuration](#configuration) section for more details. If this repo is colocated with the other ClearlyDefined repos, you can share the `env.json` file. Just merge the templates. Any colliding properties names are meant to be shared.
1. On a command line, `cd` to the repo dir and run `npm install`
1. Run `npm start`

That starts the ClearlyDefined service and has it listening for RESTful interaction at http://localhost:4000. See the [Configuration](#configuration) section for info on how to change the port. The REST APIs are (partially) described in the Swagger at http://localhost:4000/api-docs.

You may want to get the sample data. Clone the [Harvested-data](https://github.com/clearlydefined/harvested-data) repo and adjust the `FILE_STORE_LOCATION` setting your `env.json` to point to the data repo's location.

## Authorization

TBD

# Configuration

Configuration properties can be found at:

* [service/full.env.json](https://github.com/clearlydefined/service/blob/master/full.env.json)
* [service/bin/config.js](https://github.com/clearlydefined/service/blob/master/bin/config.js)

# Contributing

This project welcomes contributions and suggestions, and we've documented the details in the [contribution policy](CONTRIBUTING.md).

The [Code of Conduct](CODE_OF_CONDUCT.md) for this project is details how the community interacts in
an inclusive and respectful manner. Please keep it in mind as you engage here.

---

# Details (some of which are not up to date)

---

## System Flow

1. Scan plugin checks if it has already harvested data for a package by calling GET /harvest/...
1. If it's already harvested then it stops processing
1. If not it performs the scan and uploads the resulting files by calling PUT /harvest/...
1. User visits the site and looks up information about a package which calls GET /packages/...
   1. This gets the harvested data for a package
   1. It then normalized the harvested data to the normalized schema
   1. It then runs the summarizer to condense the normalized schemas into a single normalized schema for the package
   1. It then loads any curation patch that applies to the package and patches the normalized schema and returns the end result
1. They notice an error and edit a patch, a preview of the result of applying the patch is displayed by calling POST /packages/.../preview with the proposed patch
1. They submit the patch which calls PATCH /curations/...
1. A pull request is initiated and a build process runs against the patch
1. The build gets the normalized schema for each of the patches in the pull request by calling GET /packages/... and also a preview of the result by calling POST /packages/.../preview and puts a diff in the PR for a curator to review
1. A curator reviews the diff and if they're happy with the end result merges the PR
1. As an optimization post merge we could normalize, summarize, and patch the affected package and store the result, if we did this then GET /packages/... would simply read that cache rather than doing the work on the fly

## Normalized Schema

```
package:
  type: string
  name: string
  provider: string
  revision: string
source_location:
  provider: string
  url: string
  revision: string
  path: string
copyright:
  statements: string[]
  holders: string[]
  authors: string[]
license:
  expression: string
```

## Endpoints

### Resolved

TODO

### Curation

#### PATCH /curations/:type/:provider/:namespace/:name/:revision

##### Request Body

```
{
  "source_location": {
    "provider": "",
    "url": "",
    "revision": "",
    "path": ""
  },
  "copyright": {
    "statements": [],
    "holders": [],
    "authors": []
  },
  "license": {
    "expression": ""
  }
}
```

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
type (npm)
  provider (npmjs.org)
    name.yaml (redie)
```

Note that the package name may contain a namespace portion, if it does, then the namespace will become a directory under provider and the packageName.yaml will be stored in the namespace directory. For example, a scoped NPM package would have a directory for the scope under provider, and then the packageName.yaml would be in the scope directory. Similarly, for Maven, the groupId would be the namespace, and the artifactId would be the packageName.

```
type (git)
  provider (github.com)
    namespace (Microsoft)
      name.yaml (redie)
```

#### Format

TODO

### Harvested

Harvested data will be stored in:
https://github.com/clearlydefined/harvested-data

This location is temporary, as harvested data grows will likely need to move it out of GitHub to scale.

#### Structure

```
type
  provider
    namespace -- if none then set to '-'
      name
        revision
          tool
            toolVersion -- this is the native output file. If more than one file then they should be archived together
```

#### Raw Notes

How to handle different versions of scanners?

- Results are immutable
- Curations are tied to particular "tool configurations"
- Tool configurations are immutable
- Tool configuration and revision should be captured in the output directory

Do we merge results from different versions of ScanCode? How does this impact curation?

- New scan results flag previous curations as needing review (optimization: only if they change the result)
- The summarization process will be configured as to what tool configurations to consider for summarization (this would need to be a priority list)
- The summarization process should take into account the link from the package back to the source

Scanning a package where it's actually the source you need to scan, what to store where
Maven supports scanning sources JAR or scanning GitHub repository

- If we can determine the source location from the package, then we'll queue up the source to be scanned
- If we can't determine the source location, and the package contains "source" then we'll scan the package
- Some scanners will run on packages (such as things that inspect package manifest)
- We should track the link from the package to the source

How to handle tags?

- When we scan GitHub we need to track what tags/branches point at which commits
- We will use the long commit (40 character) reference

Need to define "origin" and/or pick another term

- Propose to use "provider"

How do we handle case sensitivity?

- If no package managers allow different packages with same name different case, then we can be case preserving, case insensitive
- We need to be case preserving because some registry endpoints are case sensitive (e.g. NPM)

Define how to do the linking

- We will store one end (package to source), we will cache/materialize the reverse link as part of a build job (or the like)

#### Format

The format of harvested data is tool-specific. Tool output is stored in the tool's native output format. If there is a choice between multiple output formats then the priorities are:

1. Machine-readable
1. Lossless
1. JSON

## Type Registry

- git
- maven
- crate
- go
- npm
- nuget
- pod
- composer
- rubygem
- deb

## Provider Registry

- central.maven.org
- maven.google
- github.com
- gitlab.com
- cocoapods.org
- crates.io
- npmjs.org
- nuget.org
- packagist.org
- proxy.golang.org
- ftp.debian.org

## Tool Name Registry

- ScanCode
- Fossology
- Licensee

## Terminology

- provider - the provider of metadata about the package (e.g. npmjs.org, github.com, nuget.org, myget.org)
- revision - used instead of version because it's a superset and valid for source
- tool configuration - a tuple used to describe the combination of a tool and a named configuration, at a minimum the named configuration should include the version of the tool, but it could also describe the combination of settings used, for example, ScanCode-2.2.1_deepscan and ScanCode-2.2.1_fastscan
- type - the format of the package (e.g. git, maven, npm)

## TODO

- Swagger to replace most of this doc
- Complete registries
- Complete terminology

## Running ORT for scanning

Build and run the container.

```
docker build -t ort .
docker run --mount type=bind,source="<path to repo>",target=/app ort scanner -d /app/output/package-json-dependencies.yml -o /app/output-scanner
```
