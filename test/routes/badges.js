// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const { expect } = require("chai");
const badgesRoutes = require("../../routes/badges");

describe("Badge Route", () => {
  it("Test 0 badge", () => {
    let component = {};
    const service = {
      get: () => {}
    };
    const promise = badgesRoutes.getComponentBadgeLink(service, request);
    promise
      .then(result => {
        expect(result).to.eq(
          "https://img.shields.io/badge/ClearlyDefined%20Score-0-red.svg"
        );
      })
      .catch(console.log);
  });
});
