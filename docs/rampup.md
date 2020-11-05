# New developer rampup / training

These are suggested steps / tips to get familiar with the codebase:

0. Clone repo, two branches: master, and prod. Correspond to dev and prod environment.
0. `npm install`, `npm test` to run tests
0. Take a look at the [README](/README.md)
0. take a look at the [package.json](/package.json) scripts section.
    * Test for tests, dev/start to run
0. Try making a change (update a package), run tests again
0. If tests are good, open a PR
    * Will run the clearlydefined.service pipeline in azdo
    * https://dev.azure.com/clearlydefined/ClearlyDefined/_build
    * The pipeline is defined in azure-pipelines.yaml
0. Can merge after approval and checks pass
    * Upon merge, pipeline will kick off: service-master: graphical definition
    * Runs npm test, build/push docker image to ACR
    * Release will kick off: service-dev: deploys and restarts azure app service: clearlydefined-api-dev
    * Note: need to address azdo release warning, needed arguments in release definition

## Local dev
### Minimal
0. See quick start in [README](/README.md#quick-start), also [minimal.env.json](/minimal.env.json)
0. Can use [curated-data-dev](https://github.com/clearlydefined/curated-data-dev) as curation repo, file store location can be local directory
    * Minimal env is not close to real service environment (no queues, blobs, etc)

### Dev-like
Better to use a copy of the real dev environment, can change queue names to be your own, same with blob storage.
* (Haven’t used storage emulator yet because not using Windows.)
0. Check bin/config.js for defaults
0. Usually, add your name to:
    * "HARVEST_AZBLOB_CONTAINER_NAME": "develop-jlm-local",                                                                                                                                                     
    * "HARVEST_QUEUE_PREFIX": "cdcrawlerdev-jlm-local",   
0. Comment/remove:
    * "Remove_APPINSIGHTS_INSTRUMENTATIONKEY": "1234",                                                                                                                       
   So no appinsights logging
0. Maybe remove:
    * "remove_CURATION_QUEUE_PROVIDER": "azure",                                                                                                                                                             
   So we don’t pull any curations off queue
0. Consider all the vars and what you need for testing what you will test. 

## Misc info
### Invalid curations?
Providers/curation/github.js: github PR’s check service to see if it is valid

### Queues
Harvest queue: crawler puts messages on queue when it is done with any tools
Curations queue: logic app puts messages on queue when it is called by github webhook

Providers/harvest/process.js, code for pulling from harvest queue
Providers/curation/process.js, code for pulling from curation queue

Githhub webhook is set to put message on queue for any change in PR status, this allows service to take different actions on ‘opened’ vs ‘merged’ etc.

### Database
What do we put in mongo / Cosmos DB? ( I see config for curations and definitions)
*	Curations: looks like pr info, coordinates. Guess: used for curation info in relation to a coordinate (in UI)
*	Definitions: mapping between attachments and definitions, finding the attachment blobs in azure storage.

### Definitions
business/definitionservice.js: code to compute definition, recomputed after harvest or curation
Website uses apis that are not listed in swagger

### Logging
Appinsights: clearlydefined-api-prod: 346 exceptions in last 24 hours, should look into them

