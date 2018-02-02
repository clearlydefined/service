// const proxyquire = require('proxyquire');
// const chai = require('chai');
// const expect = chai.expect;
// const sinon = require('sinon');
// const fs = require('fs');
// const path = require('path');
const assert = require('assert');
const FileStore = require('../../../providers/stores/file');
const ResultCoordinates = require('../../../lib/resultCoordinates');
const EntityCoordinates = require('../../../lib/entityCoordinates');

const windows = 'c:\\foo\\bar';
const linux = '/foo/bar';
const data = [
  {
    location: linux,
    path: 'npm/npmjs/namespace/name/revision/1.0',
    coordinates: { type: 'npm', provider: 'npmjs', namespace: 'namespace', name: 'name', revision: '1.0', tool: undefined, toolVersion: undefined }
  },
  {
    location: linux,
    path: 'npm/npmjs/namespace/name/revision/1.0/tool/testTool/2.0',
    coordinates: { type: 'npm', provider: 'npmjs', namespace: 'namespace', name: 'name', revision: '1.0', tool: 'testtool', toolVersion: '2.0' }
  },
  {
    location: linux,
    path: 'npm/npmjs/namespace/name',
    coordinates: { type: 'npm', provider: 'npmjs', namespace: 'namespace', name: 'name', revision: undefined, tool: undefined, toolVersion: undefined }
  },
  {
    location: linux,
    path: 'npm/npmjs/-/name/revision/1.0',
    coordinates: { type: 'npm', provider: 'npmjs', namespace: null, name: 'name', revision: '1.0', tool: undefined, toolVersion: undefined }
  },
  {
    location: windows,
    path: 'npm\\npmjs\\namespace\\name\\revision\\1.0',
    coordinates: { type: 'npm', provider: 'npmjs', namespace: 'namespace', name: 'name', revision: '1.0', tool: undefined, toolVersion: undefined }
  },
  {
    location: windows,
    path: 'npm\\npmjs\\namespace\\name',
    coordinates: { type: 'npm', provider: 'npmjs', namespace: 'namespace', name: 'name', revision: undefined, tool: undefined, toolVersion: undefined }
  },
  {
    location: windows,
    path: 'npm\\npmjs\\-\\name\\revision\\1.0',
    coordinates: { type: 'npm', provider: 'npmjs', namespace: null, name: 'name', revision: '1.0', tool: undefined, toolVersion: undefined }
  }
]
describe('path to coordinates mapping', () => {
  data.forEach(input => {
    it('works well for ' + input.path, () => {
      const fileStore = FileStore({ location: input.location });
      const separator = input.location.includes('/') ? '/' : '\\';
      const result = fileStore._toResultCoordinatesFromStoragePath(input.location + separator + input.path);
      assert.deepEqual(result, input.coordinates);
    });
  });
});

describe('coordinates to path mapping', () => {
  data.forEach(input => {
    it('works well for ' + input.path, () => {
      const fileStore = FileStore({ location: input.location });
      const result = fileStore._toStoragePathFromCoordinates(input.coordinates);
      const separator = input.location.includes('/') ? '/' : '\\';
      // account for platform differences in path separator.
      const normalizedResult = result.replace(/\\/g, '/');
      // TODO We expect much of the path to be lowercased however the approach below requires ALL 
      // of the path to be lowercased. unclear if case variation on namespace, name and revision is ok.
      const normalizedInput = (input.location + separator + input.path).replace(/\\/g, '/').toLowerCase();
      assert.deepEqual(normalizedResult, normalizedInput);
    });
  });
});

const toolData = [
  {
    location: linux,
    paths: [
      'npm/npmjs/namespace/name/revision/1.0/tool/testTool0/2.0',
      'npm/npmjs/-/name/revision/1.0/tool/testTool1/3.0'
    ],
    coordinates: [
      ['npm', 'npmjs', 'namespace', 'name', '1.0', 'testtool0', '2.0'],
      ['npm', 'npmjs', null, 'name', '1.0', 'testtool1', '3.0']
    ]
  },
  {
    location: linux,
    paths: ['npm/npmjs/namespace/name/revision/1.0/tool/testTool/2.0.json'],
    coordinates: [['npm', 'npmjs', 'namespace', 'name', '1.0', 'testtool', '2.0']]
  }
]

describe('FileStore listing content ', () => {
  toolData.forEach((input, index) => {
    it('works for well structured entity data: ' + index, async () => {
      const fileStore = FileStore({ location: input.location });
      fileStore._list = coordinates => input.paths.map(path => input.location + '/' + path);
      const list = await fileStore.list('dummy');
      list.forEach((item, index) => {
        const expectedCoordinates = new EntityCoordinates(...input.coordinates[index]);
        assert.deepEqual(item, expectedCoordinates);
      });
    });

    it('works for well structured resuilt data: ' + index, async () => {
      const fileStore = FileStore({ location: input.location });
      fileStore._list = coordinates => input.paths.map(path => input.location + '/' + path);
      const list = await fileStore.list('dummy', 'result');
      list.forEach((item, index) => {
        const expectedCoordinates = new ResultCoordinates(...input.coordinates[index]);
        assert.deepEqual(item, expectedCoordinates);
      });
    });
  });
});


// // Stubbing callbacks
// describe('when fs.readdir calls back with ["file1", "file2"]', function () {
//   var readdirStub;

//   before(function () {
//     readdirStub = sinon.stub(fs, 'readdir');
//     foo = proxyquire('./foo', { fs: { readdir: readdirStub } });

//     readdirStub.withArgs('../simple').yields(null, ['file1', 'file2']);
//   })

//   after(function () {
//     fs.readdir.restore();
//   });

//   it('filesAllCaps calls back with ["FILE1", "FILE2"]', function (done) {
//     foo.filesAllCaps('../simple', function (err, files) {
//       assert.equal(err, null);
//       assert.equal(files[0], 'FILE1');
//       assert.equal(files[1], 'FILE2');
//       done();
//     });
//   })
// })
