const {expect} = require('chai');
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

describe('Github Curation Service', () => {
  const service = createService();

  // @todo flesh out
  it('should be truthy', () => {
    expect(service).to.be.ok;
  });
});
