var _und = require("underscore");

var redisSync = require('redis-sync');
var sync = new redisSync.Sync();
var subscribers = [];

var redis = require("redis");
var client;

var proxyEnabled = false;

// PUBLIC

function init(port, host, proxyPort, proxyHost) {
  sync.connect(port, host);

  proxyPort = (_und.isUndefined(proxyPort)) ? port : proxyPort;
  proxyHost = (_und.isUndefined(proxyHost)) ? host : proxyHost;

  proxyEnabled = port != proxyPort && host != proxyHost;

  client = redis.createClient(proxyPort, proxyHost);

  // if (proxyEnabled)
  //   client.flushall;
}

function addSubscriber(pattern, callback) {
  subscribers.push({pattern: parsePattern(pattern), callback: callback});
}

// copied from https://github.com/dbrock/node-regexp-quote/blob/master/regexp-quote.js to reduce dependencies
RegExp.quote = function (string) {
  return string.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&")
}

function parsePattern(pattern) {

  if (pattern === null)
    return null
  else if (pattern[pattern.length-1] === '*')
    return new RegExp("^" + RegExp.quote(pattern.slice(0, pattern.length-1)) + "(.*)$", "g");
  else if (pattern[0] === '*')
    return new RegExp("^(.*)" + RegExp.quote(pattern.slice(1, pattern.length)) + "$", "g");
  else
    return pattern;

}

function removeSubscriber(pattern) {

  pattern = parsePattern(pattern);

  subscribers = _und(subscribers).reject(function (sub) {
    return _und.isEqual(sub.pattern, pattern);
  });

}

// PRIVATE

function publish(subs, key, args, commands) {
  _und.defer(notifySubscribers, subs, key, args, commands);
}

function findSubscribers(key) {
  return _und(subscribers).filter(function (sub) { return (_und.isRegExp(sub.pattern) && key.match(sub.pattern)) || key === sub.pattern || sub.pattern === null; });
}

function notifySubscribers(subs, key, args, commands) {

  _und(subs).each(function (sub) {
    sub.callback(key, args, commands);
  });

}

function set(args, command) { 
  var key = args[0][0].toString();
  var subs = findSubscribers(key);
  if (subs.length > 0)
    publish(subs, key, args[1][0].toString(), command);
}

function get(args, command) {
  var key = args[0][0].toString();
  var subs = findSubscribers(key);
  if (subs.length > 0)
    client.get(key, function (err, resp) { publish(subs, key, resp, command) });
}

function bitop(args, command) {
  var key = args[1][0].toString();
  var subs = findSubscribers(key);
  if (subs.length > 0)
    client.get(key, function (err, resp) { publish(subs, key, resp, command) });
}

function mset(args, command) {
  _und(args).each(function (arg, index) {
    if (index % 2 == 0) {
      var key = arg[0].toString();
      var subs = findSubscribers(key);
      if (subs.length > 0)
        publish(subs, key, args[index+1][0].toString(), command);
    }
  });
}

function setex(args, command) { 
  var key = args[0][0].toString();
  var subs = findSubscribers(key);
  if (subs.length > 0)
    publish(subs, key, args[2][0].toString()), command;
}

function hgetall(args, command) {
  var key = args[0][0].toString();
  var subs = findSubscribers(key);
  if (subs.length > 0)
    client.hgetall(key, function (err, resp) { publish(subs, key, resp, command) });
}

function lrange(args, command) {
  var key = args[0][0].toString();
  var subs = findSubscribers(key);
  if (subs.length > 0)
    client.lrange(key, 0, -1, function (err, resp) { publish(subs, key, resp, command) });
}

function rpoplpush(args, command) {
  lrange([args[0]], command);
  lrange([args[1]], command);
}

function smembers(args, command) {
  var key = args[0][0].toString();
  var subs = findSubscribers(key);
  if (subs.length > 0)
    client.smembers(key, function (err, resp) { publish(subs,key, resp, command) });  
}

function smove(args, command) {
  smembers([args[0]], command);
  smembers([args[1]], command);
}

function zrange(args, command) {
  var key = args[0][0].toString();
  var subs = findSubscribers(key);
  if (subs.length > 0)
    client.zrange(key, 0, -1, function (err, resp) { publish(subs, key, resp, command) });
}

function unknown(args, command) {

  var key = args[0][0].toString();
  var subs = findSubscribers(key);

  if (subs.length > 0) {
    client.type(key, function (err, resp) {

      if (resp == 'string')
        get(args, command)
      else if (resp == 'hash')
        hgetall(args, command)
      else if (resp == 'list')
        lrange(args, command)
      else if (resp == 'set')
        smembers(args, command)
      else if (resp == 'ordered_set')
        zrange(args, command);

    });
  }

}

var commands = {// STRINGS
                append:      get,
                bitop:       bitop,
                decr:        get,
                decrby:      get,
                getset:      get,
                incr:        get,
                incrby:      get,
                incrbyfloat: get,
                mset:        mset,
                msetnx:      mset,
                psetex:      setex,
                set:         set,
                setex:       setex,
                setbit:      get,
                setnx:       get,
                setrange:    get,
                // HASH
                hdel:         hgetall,
                hincrby:      hgetall,
                hincrbyfloat: hgetall,
                hmset:        hgetall,
                hset:         hgetall,
                hsetnx:       hgetall,
                // LISTS
                blpop:      null,
                brpop:      null,
                brpoplpush: null,
                linsert:    lrange,
                lpop:       lrange,
                lpush:      lrange,
                lpushx:     lrange,
                lrem:       lrange,
                lset:       lrange,
                ltrim:      lrange,
                rpop:       lrange,
                rpoplpush:  rpoplpush,
                rpush:      lrange,
                rpushx:     lrange,
                // SETS
                sadd:        smembers,
                sdiffstore:  smembers,
                sinterstore: smembers,
                smove:       smove,
                spop:        smembers,
                srem:        smembers,
                sunionstore: smembers,
                // SORTEDSETS
                zadd:             zrange,
                zincrby:          zrange,
                zinterstore:      zrange,
                zrem:             zrange,
                zremrangebyrank:  zrange,
                zremrangebyscore: zrange,
                zunionstare:      zrange,
                // KEYS
                del:      get,
                migrate:  get,
                move:     get,
                rename:   get,
                renamenx: get,
                restore:  get
               };

sync.on('command', function(command, args) {

  if (command != 'ping') {

    //console.log(command, args[0][0].toString(), args)

    var parser = commands[command];

    if (parser != null)
      parser(args, command)
    else
      unknown(args, command);

  }

});

exports.init             = init;
exports.addSubscriber    = addSubscriber
exports.removeSubscriber = removeSubscriber
