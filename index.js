const WebSocket = require('ws');
const Redis = require('ioredis');

const redis = new Redis({
    port: 6379, // Redis port
    host: "127.0.0.1", // Redis host
    // family: 4, // 4 (IPv4) or 6 (IPv6)
    // password: "auth",
    // db: 0
});

const wss = new WebSocket.Server({
    host: '127.0.0.1',
    port: 8080,
}, (event) => {
    console.log('WebSocket server started listening')
});

wss.on('connection', (socket, request) => {

    // Get token from query string
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);

    const token = searchParams.get('token');
    if (!token) {
        socket.terminate();     // TODO maybe use .close(code, reason) ?
        return;
    }

    // TODO we should infer user ID from the token, but for now token is the ID
    const recipientId = token;

    // Subscribe to updates for the user in redis
    redis.subscribe(recipientId, (err, count) => {
        if (!err) {
            console.log(`Subscribed UserID ${recipientId}`);
        }
    });

    redis.on("message", (channel, message) => {
        console.log("Receive message %s from channel %s", message, channel);
        socket.send(message);
    });

    socket.on('message', (data) => {
        // TODO handle
        console.log('Got message (why?):', data);
    });

    socket.on('error', (e) => {
        // TODO handle
        console.error(e);
    });

    socket.on('close', (code, reason) => {
        // TODO handle
        console.log(`Connection closed: [${code}] ${reason}`);
        redis.unsubscribe(recipientId);
    })

    // TODO add heartbeats
});
