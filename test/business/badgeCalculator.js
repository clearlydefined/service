// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const {expect} = require('chai');
const BadgeCalculator = require('../../business/badgeCalculator');

describe('BadgeCalculator', () => {
  it('gives level 1 for no data', () => {
    const definition = {};
    const badge = new BadgeCalculator(definition);
    expect(badge.calculate()).to.eq(0);
  });

  it('gives level 2 if you have just license', () => {
    const definition = {
      licensed: {
        license: 'MIT'
      }
    };
    const badge = new BadgeCalculator(definition);
    expect(badge.calculate()).to.eq(1);
  });

  it('gives level 2 if you have just copyright', () => {
    const definition = {
      licensed: {
        copyright: {
          holders: ['My copyright']
        }
      }
    };
    const badge = new BadgeCalculator(definition);
    expect(badge.calculate()).to.eq(1);
  });

  it('gives level 3 if you have both license and copyright', () => {
    const definition = {
      licensed: {
        copyright: {
          holders: ['My copyright']
        },
        license: 'MIT'
      }
    };
    const badge = new BadgeCalculator(definition);
    expect(badge.calculate()).to.eq(2);
  });
});
