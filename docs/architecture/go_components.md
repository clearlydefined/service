# ClearlyDefined Go Support Architecture (Service)

This drafts an architecture document for adding support for Go components to ClearlyDefined.

## TLDR;

* Add a new "go" type to ClearlyDefined
* Only support go modules as components (which were added in Go 1.11). [According to the Go documentation](https://blog.golang.org/using-go-modules), modules are a dependency management system that makes dependency version information explicit and easier to manage. There were other, more complicated ways of managing go dependencies prior to this, but we should only focus on modules in our first iteration. We can revisit other ways of managing go dependencies later if necessary.
* Support "proxy.golang.org" as the first go component provider, add other providers later if needed.

## Prior work

@jeffmendoza previously explored how we might add support for harvesting go components to ClearlyDefined in [this Google doc](https://docs.google.com/document/d/1T2WQ_yy3k8XIHw8oMPxz9mG4ys-SVmZ65CnJLhI2geA/edit#heading=h.gjdgxs). This has been tremendously helpful as I've explored how to implement this.

### No central Go repository

Most (if not all) of the types of components we support (maven, gem, crate, etc.) have some sort of central package repository that components are downloaded from.

Go, however, does not. Instead, go modules are pulled directly from their original source location - which is most often github.com, googlesource.com, or a few others.

### Go Proxy

Google does, however, run a [proxy for go modules](https://proxy.golang.org/). From the site:

"The Go team is providing the following services run by Google: a module mirror for accelerating Go module downloads, an index for discovering new modules, and a global go.sum database for authenticating module content.

As of Go 1.13, the go command by default downloads and authenticates modules using the Go module mirror and Go checksum database."

This allows users to download module source zips and is used by default in the Go CLI tooling.

It would make sense for us to use proxy.golang.org as our (first) provider for harvesting go modules.

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

Notice the variety in paths? Google allows "vanity" package names (like `go.uber.org/multierr` - which are automatically redirected to the source by Google's proxy service.

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
* **provider** should be "proxy.golang.org" (we may need to add other providers in the future)
* **namespace** should be anything that appears before the package name
* **name** should be the name of the package
* **revision** should be the component revision (note - go components seem to have multiple ways of specifying revisons - sometimes version numbers, sometimes commit hashes)

Like with Maven components, we translate namespaces that have multiple slashes (like `golang.org/x`) into namepaces with periods (`golang.org.x`).

For example: `go.uber.org/multierr v1.6.0` maps to `go/proxy.golang.org/go.uber.org/multierr/v1.6.0`

**Examples that seem to work well:**

* `collectd.org v0.5.0` maps to `go/proxy.golang.org/collectd.org/v0.5.0`
* `go.starlark.net v0.0.0-20210406145628-7a1108eaa012` maps to `go/proxy.golang.org/go.starlark.net/v0.0.0-20210406145628-7a1108eaa012`
* `cloud.google.com/go v0.56.0` maps to `go/proxy.golang.org/cloud.google.com/go/v0.56.0`
* `code.cloudfoundry.org/clock v1.0.0` maps to `go/proxy.golang.org/code.cloudfoundry.org/clock/v1.0.0`
* `go.uber.org/multierr v1.6.0` maps to `go/proxy.golang.org/go.uber.org/multierr/v1.6.0`
* `k8s.io/api v0.20.4` maps to `go/proxy.golang.org/k8s.io/api/v0.20.4`
* `modernc.org/sqlite v1.10.8` maps to `go/proxy.golang.org/modernc.org/sqlite v1.10.8`

**Examples that seem a little weird:**
* `github.com/Azure/azure-event-hubs-go/v3 v3.2.0` maps to `go/proxy.golang.org/github.com.Azure.azure-event-hubs-go/v3/v3.2.0`
* `golang.org/x/net v0.0.0-20210226172049-e18ecbb05110` maps to `go/proxy.golang.org/golang.org.x/net/v0.0.0-20210226172049-e18ecbb05110`

