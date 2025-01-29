## Change Notification API Calls

The system includes a built-in mechanism to [support notifications for definition changes](https://github.com/clearlydefined/service/issues/958). Changes in definitions, excluding files, and their associated coordinates are published at regular intervals. Every hour, a changeset file is released, listing the coordinates of definitions that have changed during the last hour. You can retrieve these updated definitions (excluding files) using the appropriate API. This document explains how to use the APIs designed to support change notifications.

### 1. Get List of Changeset File Names

- **Endpoint:** `GET {{baseurl}}/changes/index`
- **Description:** Retrieves a list of changeset file names. These files are published hourly and follow the naming convention `yyyy-mm-dd-hh`.
- **Example Response:** (_Partial response shown.  The real response will include the list of all changesets from 2019 to now_)
  ```
  2019-02-08-03
  2019-02-08-04
  ...
  2019-04-01-16
  ...
  ```

### 2. Get Specific Changeset

- **Endpoint:** `GET {{baseurl}}/changes/{changeset}`
- **Description:** Retrieves a specific changeset containing the coordinates of definitions that have been changed during the specified hourly interval.
- **Example Request:**
  ```
  GET {{baseurl}}/changes/2019-04-01-16
  ```
- **Example Response:**
  ```
  git/github/ithouse/git_loc_tracker/db708b224f77ba98bea5e1fc3eaff51ee0e7fd52.json
  git/github/searls/gimme/ce0c71c813cae48d0dce222be0fd326bc51fcf3f.json
  ...
  ```

### 3. Get Changed Definition

- **Endpoint:** `GET {{baseurl}}/{coordinates}.json`
- **Description:** Retrieves the changed definition without including files.
- **Example Request:**
  ```
  GET {{baseurl}}/maven/mavencentral/nl.vpro.poms/poms-shared/5.11.4.json
  ```

**Base URL** 
- Test Data: https://clearlydefineddev.blob.core.windows.net/develop-snapshots
- Production Data: https://clearlydefinedprod.blob.core.windows.net/changes-notifications
