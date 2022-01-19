# ClearlyDefined Go Support Architecture (Service)

This drafts an architecture document for adding support for Go components to ClearlyDefined.

## TLDR;

* Add a new "go" type to ClearlyDefined
* Only support go modules as components (which were added in Go 1.11). [According to the Go documentation](https://blog.golang.org/using-go-modules), modules are a dependency management system that makes dependency version information explicit and easier to manage. There were other, more complicated ways of managing go dependencies prior to this, but we should only focus on modules in our first iteration. We can revisit other ways of managing go dependencies later if necessary.
* Use 'golang' as the provider for the component. 
* Use URL encoding for slashes in go import paths and package names

## Prior work

@jeffmendoza previously explored how we might add support for harvesting go components to ClearlyDefined in [this Google doc](https://docs.google.com/document/d/1T2WQ_yy3k8XIHw8oMPxz9mG4ys-SVmZ65CnJLhI2geA/edit#heading=h.gjdgxs). This has been tremendously helpful as I've explored how to implement this.

I have also completed a few prior drafts of this architecture:

* [Go Architecture Draft 1](https://github.com/clearlydefined/service/pull/862)
* [Go Architecture Draft 2](https://github.com/clearlydefined/service/pull/864)

### No central Go repository

Most (if not all) of the types of components we support (maven, gem, crate, etc.) have some sort of central package repository that components are downloaded from.

Go, however, does not. Instead, go modules are pulled directly from their original source location - which is most often github.com, googlesource.com, or a few others.

### Go Proxy

Google does, however, run a [proxy for go modules](https://proxy.golang.org/). From the site:

"The Go team is providing the following services run by Google: a module mirror for accelerating Go module downloads, an index for discovering new modules, and a global go.sum database for authenticating module content.

As of Go 1.13, the go command by default downloads and authenticates modules using the Go module mirror and Go checksum database."

This allows users to download module source zips and is used by default in the Go CLI tooling.

It would make sense for us to use proxy.golang.org to download zips of go components (this would be done in the crawler).

### Go paths

When someone uses go modules, they have a `go.mod` file in the root of their repository. Let's look at [an example](https://github.com/influxdata/telegraf/blob/v1.19.1/go.mod):

And let's look at a few of the ways that this package's dependencies are defined:

```
	cloud.google.com/go v0.56.0
	code.cloudfoundry.org/clock v1.0.0 // indirect
	collectd.org v0.5.0
	github.com/Azure/azure-event-hubs-go/v3 v3.2.0
	go.starlark.net v0.0.0-20210406145628-7a1108eaa012
	go.uber.org/multierr v1.6.0 // indirect
	golang.org/x/net v0.0.0-20210226172049-e18ecbb05110
	k8s.io/api v0.20.4
	modernc.org/sqlite v1.10.8
```

Notice the variety in paths? Google allows "vanity" import paths (like `go.uber.org/multierr`). These point to html pages which point to the source repo for the module. It's important to understand that these paths must be valid urls. See [Vanity import paths in Go](https://sagikazarmark.hu/blog/vanity-import-paths-in-go/) for an overview of how they work.

## Constructing coordinates

In order to request a definition of a go component from ClearlyDefined (which will also queue up a harvest if ClearlyDefined does not have a definition for the component), a user will need to construct coordinates in the API call.

### For a Maven component

For example, in order to request a maven package, the API call would look like this:

```bash
curl -X GET https://clearlydefined.io/definitions/maven/mavencentral/com.apollographql.apollo3/apollo-runtime-jvm/3.0.0-dev14" -H "accept: */*"
```

In this case, the coordinates are maven/mavencentral/com.apollographql.apollo3/apollo-runtime-jvm/3.0.0-dev14

Let's break this down:
* **maven** is the **type** 
* **mavencentral** is the **provider**
* **com.apollographql.apollo3** is the **namespace**
* **apollo-runtime-jvm** is the **name**
* **3.0.0-dev14** is the **revision**

When we run this API call:

```bash
curl -X GET https://clearlydefined.io/definitions/maven/mavencentral/com.apollographql.apollo3/apollo-runtime-jvm/3.0.0-dev14" -H "accept: */*"
```

It harvests the component from [here](https://repo1.maven.org/maven2/com/apollographql/apollo3/apollo-runtime-jvm/3.0.0-dev14/).

Notice something in the url - the namespace is "com/apollographql/apollo3" - there are a lot of slashes in there. 

The way we translate this namespace into coordinates is to replace the slashes in the namespace with periods.

So "com/apollographql/apollo3" becomes "com.apollographql.apollo3".

### For a Go component

A Go component's coordinates will also need to consist of a type, provider, namespace, name, and revision.

Go's support of vanity package names makes this a little different than other components. While there are a few different approaches we could take, we should map the coordinates to what go developers know the package as.

* **type** should be go
* **provider** should be 'golang'
* **namespace** should be anything that appears before the package name in the import path (it should be "-" if nothing appears before the package name)
* **name** should be the name of the package
* **revision** should be the component revision (note - go components seem to have multiple ways of specifying revisions - sometimes version numbers, sometimes commit hashes)

A challenge with go components is that import paths and package names can contain slashes and periods - which makes translating them into valid coordinates more difficult.

In previous drafts, I considered replacing slashes with periods like with Maven components, but periods are also valid characters in Go import paths. Any character that can appear in a url can be used in an import path and package name. I considered using a different character to replace slashes in components...but this has the potential to become very confusing and inconsistent. In order to be as straightforward and consistent as possible, we need to use [URL encoding](https://www.tutorialspoint.com/html/html_url_encoding.htm) for slashes in go components (and potentially in other components as well).

### Examples 

* `collectd.org v0.5.0` maps to `go/golang/-/collectd.org/v0.5.0`
* `go.starlark.net v0.0.0-20210406145628-7a1108eaa012` maps to `go/golang/-/go.starlark.net/v0.0.0-20210406145628-7a1108eaa012`
* `cloud.google.com/go v0.56.0` maps to `go/golang/cloud.google.com/go/v0.56.0`
* `golang.org/x/net v0.0.0-20210226172049-e18ecbb05110` maps to `go/golang/golang.org%2fx/net/v0.0.0-20210226172049-e18ecbb05110`
* `github.com/Azure/azure-event-hubs-go/v3 v3.2.0` maps to `go/golang/github.com%2fAzure%2fazure-event-hubs-go/v3/v3.2.0`