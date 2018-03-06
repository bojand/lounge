const EventEmitter = require('events')
const _ = require('lodash')
const couchbase = require('couchbase')
const Driver = require('couchbase-driver')

const Schema = require('./schema')
const Document = require('./document')
const CouchbaseDocument = require('./cbdocument')
const utils = require('./utils')
const { compile, Model } = require('./model')

const debug = require('debug')('lounge')

const schemaConfigOptions = utils.schemaConfigOptionKeys

class Lounge extends EventEmitter {
  /**
   * @classdesc The Lounge module
   * The exports object of the <code>lounge</code> module is an instance of this class.
   * Most apps will only use this one instance. We copy all Couchbase <code>Bucket</code> methods and properties
   * so you can call them generically = require(this instance as well.
   *
   * @description The Lounge constructor
   * @class
   * @augments Bucket
   * @param {Object} options
   * @param {String} options.keyPrefix - key prefix for all keys. No default. Generally useful if you wish to namespace documents. Example: <code>app::env::</code>.
   * @param {String} options.keySuffix - Similar as prefix but used as a suffix
   * @param {Boolean} options.storeFullReferenceId - whether to store embedded document keys as fully expanded keys (with prefix and suffix applied)
   * or just the minimized version. default: <code>false</code>
   * @param {Boolean} options.storeFullKey - Similarly to store the fully expanded document key inside the key property. default: <code>false</code>
   * @param {Boolean} options.alwaysReturnArrays - set to true to force <code>findyById</code> to always return an array of documents even if only a single key is passed in
   * @param {String} options.refIndexKeyPrefix - reference lookup index document key prefix. The name of the index is appended. default: <code>$_ref_by_</code>
   * @param {String} options.delimiter - delimiter string used for concatenation in reference document key expansion / generation. default: <code>'_'</code>. This is prepended to the reference document key.
   * @param {Boolean} options.waitForIndex - When documents are saved, indexes are updated. We can wait for this operation to finish before
   * returning = require(<code>save()</code>. Default: <code>false</code>
   * @param {Boolean} options.minimize - "minimize" schemas by removing empty objects. Default: <code>true</code>
   * @param {Boolean} options.missing By default the <code>findById</code> and index query functions return 3 parameters to the callback:
   *                                  <code>(err, docs, missing)</code>. If this option is set to <code>false</code> we won't return
   *                                  missing keys as the final param in the callback. Default: <code>true</code>.
   * @param {Boolean} options.retryTemporaryErrors - Whether to automatically backoff/retry on temporary
   *                                       couchbase errors. Default: <code>false</code>.
   *                                            See {@link https://github.com/bojand/couchbase-driver}
   * @param {Number} options.tempRetryTimes - The number of attempts to make when backing off temporary errors.
   *                                            See <code>async.retry</code>. Default: <code>5</code>.
   *                                            See {@link https://github.com/bojand/couchbase-driver}
   * @param {Number} options.tempRetryInterval - The time to wait between retries, in milliseconds, when backing off temporary errors .
   *                                               See <code>async.retry</code>. Default: <code>50</code>.
   *                                            See {@link https://github.com/bojand/couchbase-driver}
   * @param {Number} options.atomicRetryTimes - The number of attempts to make within <code>Driver.atomic()</code>. Default: <code>5</code>.
   *                                            See {@link https://github.com/bojand/couchbase-driver}
   * @param {Number} options.atomicRetryInterval - The time to wait between retries, in milliseconds, within <code>Driver.atomic()</code>.
   *                                               Default: <code>0</code>. See {@link https://github.com/bojand/couchbase-driver}
   * @param {Boolean} options.atomicLock - Whether to use <code>getAndLock</code> or standard <code>get</code> during atomic
   *                                       operations within indexing. Default: <code>true</code>.
   *                                       See {@link https://github.com/bojand/couchbase-driver}
   * @param {Boolean} options.promisify - to enable promise support. By default all async functions support promises and return a promise.
   *                                      To disable promise support set this  option to <code>false</code>, ideally at start before
   *                                      doing <code>connect</code> or any other operations. Default: <code>true</code>.
   * @param {Boolean} options.errorOnMissingIndex - error when a document referenced by index reference document is missing. Default: `false`
   *                                                The error will have `reference` property of document reference target document id(s).
   *                                                The error will have `missing` property of missing document ids.
   * @param {Boolean} options.emitErrors - Whether to broadcast error events. Default: `true`
   *
   * @returns {Lounge}
   */
  constructor (options = {}) {
    super()
    this.models = {}
    this.bucket = null
    this.db = null
    this.config = _.defaults(options || {}, utils.defaultOptions)
  }

  /**
   * Connect to the database. You may define Models before connecting, but you should not create any actual document
   * instances before connecting to the database.
   * @public
   * @param {Object} options
   * @param {String} options.connectionString - connection string for the cluster
   * @param {String|Bucket} options.bucket - name of the bucket or the actual Couchbase <code>bucket</code> instance
   * @param {String} options.password - password
   * @param {String} options.certpath - certpath for cluster
   * @param {Boolean} options.mock - whether to use mocking
   * @param {Function} fn callback
   * @return {Bucket} Couchbase <code>Bucket</code> instance
   * @example
   * lounge.connect({
   *   connectionString: 'couchbase://127.0.0.1',
   *   bucket: 'lounge_test'
   * })
   */
  connect (options, fn) {
    return utils.promisifyCall(this, this._connect, ...arguments)
  }

  _connect (options, fn) {
    if (!options) {
      throw new Error('Need options for connect()')
    }

    if (!fn) {
      fn = _.noop
    }

    const self = this

    function retFn (err, bucket) {
      const b = bucket || self.bucket
      if (b) {
        self.db = Driver.create(b, self.config)
      }
      return fn(err, bucket || self.bucket)
    }

    if (options.bucket && typeof options.bucket === 'object') {
      debug(`connect to open bucket`)
      this.bucket = options.bucket

      if (this.bucket) {
        this.db = Driver.create(this.bucket, this.config)
      }

      process.nextTick(() => retFn(null, this.bucket))
    } else if (options.bucket && typeof options.bucket === 'string' &&
      options.connectionString && typeof options.connectionString === 'string') {
      debug(`connect. cluster: ${options.connectionString} bucket: ${options.bucket}`)

      const clusterOpts = options.certpath ? {
        certpath: options.certpath
      } : null
      const ClusterCtor = options.mock || process.env.LOUNGE_COUCHBASE_MOCK ? couchbase.Mock.Cluster : couchbase.Cluster
      const args = options.password ? [options.bucket, options.password, retFn] : [options.bucket, retFn]

      const cluster = new ClusterCtor(options.connectionString, clusterOpts)
      this.bucket = cluster.openBucket(...args)
    }
  }

  /**
   * Disconnect = require(the bucket. Deletes all defined models.
   */
  disconnect () {
    debug('disconnect')
    if (this.bucket) {
      this.bucket.disconnect()
    }

    delete this.models
    delete this.db

    this.models = {}
    this.db = null
  }

  /**
   * Creates a schema. Prefer to use this over Schema constructor as this will pass along Lounge config settings.
   *
   * @public
   * @param {Object} descriptor the schema descriptor
   * @param {Object} options Schema options
   * @return {Schema} created <code>Schema</code> instance
   * @example
   * var schema = lounge.schema({ name: String })
   */
  schema (descriptor, options = {}) {
    const opts = _.defaults(options, _.pick(this.config, schemaConfigOptions))
    return new Schema(descriptor, opts)
  }

  /**
   * Creates a model = require(a schema.
   *
   * @public
   * @param {String} name name of the model.
   * @param {Schema} schema instance
   * @param {Object} options
   * @param {Object} options.freeze - to Freeze model. See <code>Object.freeze</code>. Default: <code>true</code>
   * @returns {ModelInstance} The created <code>ModelInstance</code> class.
   * @example
   * var Cat = lounge.model('Cat', schema)
   */
  model (name, schema, options = {}) {
    if (!(schema instanceof Schema)) {
      const opts = _.defaults(options, _.pick(this.config, schemaConfigOptions))
      schema = new Schema(schema, opts)
    }

    if (this.models[name]) {
      return this.models[name]
    }

    const M = compile(schema, options, name, this)
    this.models[name] = M
    return M
  }

  /**
   * Returns the model given the name.
   * @param name
   * @returns {Model|undefined} The <code>ModelInstance</code> or <code>undefined</code> if the model by that name does
   * not exist.
   * @example
   * var Cat = lounge.getModel('Cat')
   */
  getModel (name) {
    return this.models[name]
  }

  /**
   * Sets lounge config options
   *
   * @public
   * @param key {String} the config key
   * @param value {*} option value
   */
  setOption (key, value) {
    if (arguments.length === 1) {
      return this.config[key]
    }

    this.config[key] = value
    return this
  }

  /**
   * Get config option.
   * @param key {String} the config key
   * @return {*} Option value
   */
  getOption (key) {
    return this.setOption(key)
  }

  /**
   * Returns an array of model names created on this instance of Lounge.
   *
   * @public
   * @return {Array} Array of model names registered.
   * @example
   * console.log(lounge.modelNames()) // [ 'Cat', 'Dog' ]
   */
  modelNames () {
    return Object.keys(this.models)
  }

  /**
   * The Lounge Schema constructor
   *
   */
  get Schema () {
    return Schema
  }

  /**
   * The Lounge Model constructor.
   */
  get Model () {
    return Model
  }

  /**
   * The Lounge CouchbaseDocument constructor.
   */
  get CouchbaseDocument () {
    return CouchbaseDocument
  }

  /**
   * The Lounge Document constructor.
   *
   */
  get Document () {
    return Document
  }

  /**
   * The Lounge constructor
   * The exports of the Lounge module is an instance of this class.
   */
  get Lounge () {
    return Lounge
  }
}

/**
 * Inherit all Couchbase Bucket functions and apply them to our bucket
 */
;
['append',
  'counter',
  'get',
  'getAndLock',
  'getAndTouch',
  'getMulti',
  'getReplica',
  'insert',
  'invalidateQueryCache',
  'listAppend',
  'listGet',
  'listPrepend',
  'listRemove',
  'listSet',
  'listSize',
  'lookupIn',
  'manager',
  'mapAdd',
  'mapGet',
  'mapRemove',
  'mapSize',
  'mutateIn',
  'prepend',
  'query',
  'queuePop',
  'queuePush',
  'queueSize',
  'remove',
  'replace',
  'setAdd',
  'setExists',
  'setRemove',
  'setSize',
  'setTranscoder',
  'touch',
  'unlock',
  'upsert'
].forEach(key => {
  Lounge.prototype[key] = function () {
    if (this.db) {
      return this.db[key](...arguments)
    }
  }
})

/**
 * Inherit all Couchbase Bucket properties and apply them to our bucket
 */
;
[
  'clientVersion',
  'configThrottle',
  'connectionTimeout',
  'durabilityInterval',
  'durabilityTimeout',
  'lcbVersion',
  'managementTimeout',
  'n1qlTimeout',
  'nodeConnectionTimeout',
  'operationTimeout',
  'viewTimeout'
].forEach(key => {
  Object.defineProperty(Lounge.prototype, key, {
    get: propertyGetWrapper(key),
    set: propertySetWrapper(key)
  })
})

function propertyGetWrapper (key) {
  return function () {
    if (this.bucket) {
      return this.bucket[key]
    }
  }
}

function propertySetWrapper (key) {
  return function (value) {
    if (this.bucket) {
      this.bucket[key] = value
    }
  }
}

module.exports = Lounge
