// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const SPDX = require('@clearlydefined/spdx')
const { expect } = require('chai')

describe('SPDX utility functions', () => {
  it('parses spdx expressions', () => {
    const data = new Map([
      [{ license: 'MIT' }, { license: 'MIT' }],
      ['MIT', { license: 'MIT' }],
      ['mit', { license: 'MIT' }],
      ['MIT ', { license: 'MIT' }],
      [' MIT', { license: 'MIT' }],
      ['MIT OR Apache-2.0', { left: { license: 'MIT' }, conjunction: 'or', right: { license: 'Apache-2.0' } }],
      ['MIT AND Apache-2.0', { left: { license: 'MIT' }, conjunction: 'and', right: { license: 'Apache-2.0' } }],
      [
        'MIT OR (BSD-2-Clause AND GPL-2.0)',
        {
          left: { license: 'MIT' },
          conjunction: 'or',
          right: { left: { license: 'BSD-2-Clause' }, conjunction: 'and', right: { license: 'GPL-2.0' } }
        }
      ],
      [
        'MIT OR BSD-2-Clause OR (BSD-3-Clause AND Unlicense)',
        {
          left: { license: 'MIT' },
          conjunction: 'or',
          right: {
            left: { license: 'BSD-2-Clause' },
            conjunction: 'or',
            right: { left: { license: 'BSD-3-Clause' }, conjunction: 'and', right: { license: 'Unlicense' } }
          }
        }
      ],
      [
        'MIT AND BSD-3-Clause WITH GCC-exception-3.1 OR (CC-BY-4.0 AND Apache-2.0)',
        {
          left: {
            left: { license: 'MIT' },
            conjunction: 'and',
            right: { license: 'BSD-3-Clause', exception: 'GCC-exception-3.1' }
          },
          conjunction: 'or',
          right: {
            left: { license: 'CC-BY-4.0' },
            conjunction: 'and',
            right: { license: 'Apache-2.0' }
          }
        }
      ],
      ['Apache-2.0 WITH Autoconf-exception-2.0', { license: 'Apache-2.0', exception: 'Autoconf-exception-2.0' }],
      ['Apache-2.0 WITH commons-clause', { license: 'Apache-2.0', exception: 'NOASSERTION' }]
    ])

    data.forEach((expected, input) => {
      expect(SPDX.parse(input)).to.deep.equal(expected)
    })
  })

  it('stringifies spdx objects', () => {
    const data = new Map([
      [{ license: 'MIT' }, 'MIT'],
      [{ left: { license: 'MIT' }, conjunction: 'and', right: { license: 'Apache-2.0' } }, 'MIT AND Apache-2.0'],
      [{ left: { license: 'MIT' }, conjunction: 'or', right: { license: 'Apache-2.0' } }, 'MIT OR Apache-2.0'],
      [
        {
          left: { license: 'MIT' },
          conjunction: 'or',
          right: { left: { license: 'BSD-2-Clause' }, conjunction: 'and', right: { license: 'GPL-2.0' } }
        },
        'MIT OR BSD-2-Clause AND GPL-2.0'
      ],
      [
        {
          left: { license: 'MIT' },
          conjunction: 'or',
          right: {
            left: { license: 'BSD-2-Clause' },
            conjunction: 'or',
            right: { left: { license: 'BSD-3-Clause' }, conjunction: 'and', right: { license: 'Unlicense' } }
          }
        },
        'MIT OR (BSD-2-Clause OR BSD-3-Clause AND Unlicense)'
      ],
      [
        {
          left: {
            left: { license: 'MIT' },
            conjunction: 'and',
            right: { license: 'BSD-3-Clause', exception: 'GCC-exception-3.1' }
          },
          conjunction: 'or',
          right: {
            left: { license: 'CC-BY-4.0' },
            conjunction: 'and',
            right: { license: 'Apache-2.0' }
          }
        },
        'MIT AND BSD-3-Clause WITH GCC-exception-3.1 OR CC-BY-4.0 AND Apache-2.0'
      ],
      [{ license: 'Apache-2.0', exception: 'Autoconf-exception-2.0' }, 'Apache-2.0 WITH Autoconf-exception-2.0'],
      [{ license: 'Apache-2.0', exception: 'NOASSERTION' }, 'NOASSERTION']
    ])

    data.forEach((expected, input) => {
      expect(SPDX.stringify(input)).to.equal(expected)
    })
  })

  it('satisfies spdx expressions', () => {
    const data = new Map([
      [['MIT', 'MIT'], true],
      [['mit', 'MIT'], true],
      [['MIT', 'mit'], true],
      [['MIT', 'BSD-3-Clause'], false],
      [['MIT OR Apache-2.0', 'MIT'], true],
      [['MIT AND Apache-2.0', 'MIT'], false],
      [['MIT AND Apache-2.0', 'MIT AND Apache-2.0'], true],
      [['MIT AND ISC', '(MIT OR GPL-2.0) AND ISC'], true],
      [['MIT AND NOASSERTION', 'MIT'], false],
      [['MIT OR NOASSERTION', 'MIT'], true],
      [['NOASSERTION OR JUNK', 'MIT'], false],
      [['NOASSERTION', 'LGPL-2.1+'], false]
    ])

    data.forEach((expected, input) => {
      expect(SPDX.satisfies(input[0], input[1])).to.eq(expected)
    })
  })

  it('OR merges spdx expressions', () => {
    const data = new Map([
      [['MIT', 'MIT'], 'MIT'],
      [['MIT', 'BSD-3-Clause'], 'BSD-3-Clause OR MIT'],
      [['MIT OR Apache-2.0', 'MIT'], 'Apache-2.0 OR MIT'],
      [['MIT OR Apache-2.0', 'ISC OR GPL-3.0'], 'Apache-2.0 OR GPL-3.0 OR ISC OR MIT'],
      [['MIT AND Apache-2.0', 'MIT'], 'MIT OR (Apache-2.0 AND MIT)'],
      [['MIT AND Apache-2.0', 'MIT AND Apache-2.0'], 'Apache-2.0 AND MIT'],
      [['MIT AND ISC', '(MIT OR GPL-2.0) AND ISC'], '(GPL-2.0 AND ISC) OR (ISC AND MIT)'],
      [['MIT AND NOASSERTION', 'MIT'], 'MIT OR (MIT AND NOASSERTION)'],
      [['MIT OR NOASSERTION', 'MIT'], 'MIT OR NOASSERTION'],
      [['NOASSERTION OR JUNK', 'MIT'], 'MIT OR NOASSERTION']
    ])

    data.forEach((expected, input) => {
      expect(SPDX.merge(input[0], input[1])).to.eq(expected)
    })
  })

  it('AND merges spdx expressions', () => {
    const data = new Map([
      [['MIT', 'MIT'], 'MIT'],
      [['MIT', 'BSD-3-Clause'], 'BSD-3-Clause AND MIT'],
      [['MIT OR Apache-2.0', 'MIT'], 'MIT OR (Apache-2.0 AND MIT)'],
      [
        ['MIT OR Apache-2.0', 'ISC OR GPL-3.0'],
        '(Apache-2.0 AND GPL-3.0) OR (Apache-2.0 AND ISC) OR (GPL-3.0 AND MIT) OR (ISC AND MIT)'
      ],
      [['MIT AND Apache-2.0', 'MIT'], 'Apache-2.0 AND MIT'],
      [['MIT AND Apache-2.0', 'MIT AND Apache-2.0'], 'Apache-2.0 AND MIT'],
      [['MIT AND ISC', '(MIT OR GPL-2.0) AND ISC'], '(GPL-2.0 AND ISC AND MIT) OR (ISC AND MIT)'],
      [['MIT AND NOASSERTION', 'MIT'], 'MIT AND NOASSERTION'],
      [['MIT OR NOASSERTION', 'MIT'], 'MIT OR (MIT AND NOASSERTION)'],
      [['NOASSERTION OR JUNK', 'MIT'], 'MIT AND NOASSERTION']
    ])

    data.forEach((expected, input) => {
      expect(SPDX.merge(input[0], input[1], 'AND')).to.eq(expected)
    })
  })

  it('should expand expressions', () => {
    const data = [
      ['MIT', [['MIT']]],
      ['MIT AND GPL-3.0', [['GPL-3.0', 'MIT']]],
      ['MIT OR GPL-3.0', [['MIT'], ['GPL-3.0']]],
      ['MIT AND (GPL-3.0 OR BSD-3-Clause)', [['GPL-3.0', 'MIT'], ['BSD-3-Clause', 'MIT']]],
      ['(MIT OR GPL-3.0) AND ISC', [['ISC', 'MIT'], ['GPL-3.0', 'ISC']]]
    ]
    data.forEach(input => {
      const results = SPDX.expand(input[0])
      input[1].forEach(expected => {
        expect(results).to.deep.include(expected)
      })
    })
  })

  it('normalizes spdx expressions', () => {
    // prettier-ignore
    const data = {
      'AGPL-1.0': 'AGPL-1.0',
      'apache-2.0': 'Apache-2.0',
      'apache2': 'NOASSERTION',
      'GPL-': 'NOASSERTION',
      'GPL-2.0-with-autoconf-exception': 'GPL-2.0-with-autoconf-exception',
      'GPL-3.0': 'GPL-3.0',
      'GPL': 'NOASSERTION',
      'mit': 'MIT',
      'MIT ': 'MIT',
      ' MIT': 'MIT',
      'GPL-1.0+': 'GPL-1.0+',
      'Apache-2.0 WITH commons-clause': 'NOASSERTION',
      'NOASSERTION': 'NOASSERTION',
      'See license': 'NOASSERTION',
      'MIT OR Apache-2.0': 'MIT OR Apache-2.0',
      'MIT AND LGPL-2.1+ AND BSD-3-Clause': 'MIT AND LGPL-2.1+ AND BSD-3-Clause',
      '(MIT AND BSD-3-Clause WITH GCC-exception-3.1) OR (CC-BY-4.0 AND Apache-2.0)': 'MIT AND BSD-3-Clause WITH GCC-exception-3.1 OR CC-BY-4.0 AND Apache-2.0',
      'MIT AND BSD-3-Clause AND CC-BY-4.0': 'MIT AND BSD-3-Clause AND CC-BY-4.0',
      'MIT OR Junk': 'MIT OR NOASSERTION',
      'mit OR Junk': 'MIT OR NOASSERTION',
      'Commercial AND Apache-2.0': 'NOASSERTION AND Apache-2.0',
      'Junk1 OR Junk 2': 'NOASSERTION',
      ' ': null,
      null: null
    }
    for (let input of Object.keys(data)) {
      if (input === 'null') input = null
      expect(SPDX.normalize(input)).to.eq(data[input])
    }
  })

  it('looks up spdx by name', () => {
    const data = {
      'Apache License 2.0': 'Apache-2.0',
      ' Apache License 2.0 ': 'Apache-2.0',
      'apache license 2.0': 'Apache-2.0',
      'MIT License': 'MIT',
      MIT: null,
      ' ': null,
      null: null
    }
    for (let input of Object.keys(data)) {
      if (input === 'null') input = null
      expect(SPDX.lookupByName(input)).to.eq(data[input])
    }
  })
})
