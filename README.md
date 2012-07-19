redis-key-pubsub
================

This allows you to subscribe to changes made to any key in Redis, not just a channel, by specifying either a key name, regex or even a * if you want.


#### WARNING: Proof of concept

I threw this together one night while watching a couple of Jeremy Brett's Sherlock Holmes episodes after discovering that Redis didn't already do this when I thought it did. I currently have no idea how performant/stable/scalable this is.


#### How it works

I initially looked at the Redis source and quickly decided I didn't want to be wading into that, so this implementation is a Node based redis slave that doesn't acutally store the data (yet).

It uses the [SYNC](http://redis.io/commands/sync) command to receive all commands that change data and either infers the new key value from that or reads the current value back from the master Redis instance for me.


#### Limitations

Because of how it currently works the value sent to subscribers is the latest value, not neccessarly the value that was set. I plan on using this as a real-time monitoring dashboard so that's not really an issue.

I'm considering an update where there is a backing Redis instance that all the SYNC commands are echoed to, then when a read is needed it can be taken from there and will be what was just set.

Lua scripts are not parsed or executed. This is the only major drawback I don't see an easy solution for. I don't have plans to use them so it's not an issue for me. Given [MONITOR](http://redis.io/commands/monitor) is for debugging I'm not particullarly keen on using that.


#### Example

There is an example app which just shows live page views grouped by ten seconds.

    npm install
    node example.js

Spin it up as above and then open a couple of browser pages, http://localhost:4000, and refresh one of them a bunch of times while looking at the other.

Whats going on here is that everytime the page is refreshed I'm [INCR](http://redis.io/commands/incr) a pageView:timestamp key where 'timestamp' is the current time divided by ten, so I get a new key every ten seconds. To then learn about the changes to those keys I've subscribed to the 'pageView:*' keys like this:


    var redis_key_pubsub = require('./redis-key-pubsub');

    redis_key_pubsub.init(port, host);

    redis_key_pubsub.addSubscriber('pageViews:*', function (key, args, command) {
      pageViews = args;
      io.sockets.emit('pageViews', {time: key.split(':')[1], value: args});
    });

The callback is fired each time the key changes, in this case my callback just emits the updated count back to the browser which updates the [D3](http://d3js.org/) graph.


#### My use case

We'll be using it at work in a dashboard showing the current state of a queue based file processing tool chain. We're setting up a bunch of keys to watch that'll give us a really good live view of what's happening.







