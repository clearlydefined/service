const {expect} = require('chai');
const fs = require('fs');
const path = require('path');
const GitHubCurationService = require('../../providers/curation/github');

function createService() {
  return GitHubCurationService({
    owner: 'foobar',
    repo: 'foobar',
    branch: 'foobar',
    token: 'foobar',
    webhookSecret: 'foobar',
    tempLocation: '.'
  });
}

function getFixture(file) {
  return fs.readFileSync(path.join(__dirname, '../fixtures', file), {encoding: 'utf8'});
}
describe('Github Curation Service', () => {
  const service = createService();

  it('should validate curation yaml files', () => {
    const invalidCuration = getFixture('curation-invalid.yaml');
    expect(service.isValidCuration(invalidCuration)).to.not.be.ok;

    const validCuration = getFixture('curation-valid.yaml');
    expect(service.isValidCuration(validCuration)).to.be.ok;
  });
});
