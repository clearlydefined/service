const devApiBaseUrl = 'https://dev-api.clearlydefined.io'
const prodApiBaseUrl = 'https://api.clearlydefined.io'

const pollingInterval = 1000 * 60 * 5 // 5 minutes
const pollingMaxTime = 1000 * 60 * 30 // 30 minutes

const harvestToolVersions = [
  ['licensee', '9.14.0'],
  ['scancode', '30.3.0'],
  ['reuse', '3.2.1']
]

const components = [
  'maven/mavencentral/org.apache.httpcomponents/httpcore/4.4.16',
  'maven/mavengoogle/android.arch.lifecycle/common/1.0.1',
  'maven/gradleplugin/io.github.lognet/grpc-spring-boot-starter-gradle-plugin/4.6.0',
  'crate/cratesio/-/ratatui/0.26.0',
  'npm/npmjs/-/redis/0.1.0',
  'git/github/ratatui-org/ratatui/bcf43688ec4a13825307aef88f3cdcd007b32641',
  'gem/rubygems/-/sorbet/0.5.11226',
  'pypi/pypi/-/platformdirs/4.2.0',
  'go/golang/rsc.io/quote/v1.3.0',
  'nuget/nuget/-/HotChocolate/13.8.1'
  // 'composer/packagist/symfony/polyfill-mbstring/1.11.0',
  // 'pod/cocoapods/-/SoftButton/0.1.0',
  // 'deb/debian/-/mini-httpd/1.30-0.2_arm64'
  // 'debsrc/debian/-/mini-httpd/1.30-0.2_arm64',
  // 'sourcearchive/mavencentral/org.apache.httpcomponents/httpcore/4.1'
]

module.exports = {
  devApiBaseUrl,
  prodApiBaseUrl,
  components,
  harvest: {
    poll: { interval: pollingInterval, maxTime: pollingMaxTime },
    harvestToolVersions,
    timeout: 1000 * 60 * 60 * 2 // 2 hours
  },
  definition: {
    timeout: 1000 * 20 // 20 seconds
  }
}
