// SPDX-License-Identifier: MIT

const redis = require('redis');
const util = require('util');

class RedisCache {

  constructor(options) {
    this.redis = redisLib.createClient(options);
    this._redisGet = util.promisify(this.redis.get);
    this._redisSet = util.promisify(this.redis.set);
  }

  async get(item) {
    return await this._redisGet(item);
  }

  async set(item, value, expirationSeconds) {
    await this._redisSet(item, value, 'EX', expirationSeconds);
  }

}

module.exports = (options) => new RedisCache(options);