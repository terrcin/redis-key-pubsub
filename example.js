var redis = require("redis");
var redis_client = redis.createClient();

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs');

app.listen(4000, 'bob');

function timestamp() {
  return Math.floor(new Date().getTime() / 10000);  // round to a minute
}

function handler (req, res) {

  if (req.url == '/') {

    fs.readFile(__dirname + '/example.html',
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }

      res.writeHead(200);
      res.end(data);

      redis_client.incr('pageViews:' + timestamp());
    });
    
  }
  else { // likely to be for favcon.ico
    res.writeHead(404);
    res.end();
  }

}

io.sockets.on('connection', function (socket) {
  socket.emit('pageViews', {time: timestamp(), value: pageViews });
});

var pageViews = 0;
var redis_key_pubsub = require('./redis-key-pubsub');

redis_key_pubsub.init();
redis_key_pubsub.addSubscriber('pageViews:*', function (key, args, command) {
  pageViews = args;
  io.sockets.emit('pageViews', {time: key.split(':')[1], value: args});
});
