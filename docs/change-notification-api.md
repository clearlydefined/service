## Change Notification API Calls

The system includes a built-in mechanism to [support notifications for definition changes](https://github.com/clearlydefined/service/issues/958). Changes in definitions, excluding files, and their associated coordinates are published at regular intervals. Every hour, a changeset file is released, listing the coordinates of definitions that have changed during the last hour. You can retrieve these updated definitions (excluding files) using the appropriate API. This document explains how to use the APIs designed to support change notifications.

### 1. Get List of Changeset File Names

- **Endpoint:** `GET {{baseurl}}/changes/index`
- **Description:** Retrieves a list of changeset file names. These files are published hourly and follow the naming convention `yyyy-mm-dd-hh`.
- **Example Response:**
  ```
  2019-04-01-01
  2019-02-07-23
  ```

### 2. Get Specific Changeset

- **Endpoint:** `GET {{baseurl}}/changes/{changeset}`
- **Description:** Retrieves a specific changeset containing the coordinates of definitions that have been changed during the specified hourly interval.
- **Example Request:**
  ```
  GET {{baseurl}}/changes/2019-02-07-23
  ```
- **Example Response:**
  ```
  composer/packagist/alibabacloud/dysmsapi-20170525/1.0.0.json
  composer/packagist/alibabacloud/dysmsapi-20170525/1.0.2.json
  ```

### 3. Get Changed Definition

- **Endpoint:** `GET {{baseurl}}/{coordinates}.json`
- **Description:** Retrieves the changed definition without including files.
- **Example Request:**
  ```
  GET {{baseurl}}/composer/packagist/alibabacloud/dysmsapi-20170525/1.0.0.json
  ```

**Base URL for Test Data:** https://clearlydefineddev.blob.core.windows.net/develop-snapshots
