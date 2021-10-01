# ClearlyDefined Unsuccessful Harvest Architecture Proposal

This drafts an architecture for temporarily caching unsuccessful harvest requests.

## How does it work currently?

### Successful Harvest

* A user makes a request for a definition from ClearlyDefined with coordinates like `git/github/my-org/my-repo/commit-hash-123`. For example:

```bash
$ curl https://api.clearlydefined.io/definitions/git/github/my-org/my-repo/commit-hash-123
```

* ClearlyDefined checks whether it has a definition for those coordinates
* If it does not have a definition, it places a message in the Crawler's harvest queue (in our prod infrastrure, this is `cdcrawlerprod`)
* The crawler will then pull entries off the harvest queue and attempt to execute a harvest
* In the case of coordinates with `git/github` for the type and provider, it attempts to clone the repo from GitHub
* If it is successful in cloning the repo and harvesting license information, the crawler will then store the harvest information in a store (in the case of our prod infra, in an Azure blob)
* The crawler will then call a webhook on the service (in the case of prod, `https://dev-api.clearlydefined.io/webhook`), the service will then take further action with the harvest

### Unsuccessful Harvest

* A user makes a request for a definition from ClearlyDefined with coordinates like `git/github/non-existant/repo/commit-hash-123`
* If ClearlyDefined does not have a definition for those coordinates, it queues up a harvest for the Crawler
* If it is not successful in cloning the repo (possibly because the GitHub repo is non-existent or is private), the harvest fails
* TODO: Does it report anything back to the service in this case?

## How should it work?