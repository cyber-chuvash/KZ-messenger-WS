const WebSocket = require('ws');
const Redis = require('ioredis');
const config = require('config');

const redisConfig = config.get('redisConfig');
const WSSConfig = config.get('WSSConfig');

const redis = new Redis(redisConfig);

const wss = new WebSocket.Server(WSSConfig, (event) => {
    console.log('WebSocket server started listening')
});

// Store the number of listeners for each recipientId,
// in order to unsub from the channel when there's no listeners left on it
const listenerCounts = {};

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

    if (!listenerCounts[recipientId]) {    // If undefined OR == 0
        // Subscribe to updates for the user in redis
        redis.subscribe(recipientId, (err, count) => {
            if (!err) {
                console.debug(`Subscribed UserID ${recipientId}`);
            }
        });
    }

    const handleMessage = (channel, message) => {
        if (channel === recipientId) {
            console.debug("Receive message %s from channel %s", message, channel);
            socket.send(message);
        }
    };

    redis.on("message", handleMessage);

    listenerCounts[recipientId] = listenerCounts[recipientId] + 1 || 1;
    console.debug(`Added listener for channel #${recipientId}, total # of listeners: ${listenerCounts[recipientId]}`);

    socket.on('message', (data) => {
        // TODO handle
        console.log('Got message (why?):', data);
    });

    socket.on('error', (e) => {
        // TODO handle
        console.error(e);
    });

    socket.on('close', (code, reason) => {
        console.debug(`Connection closed with recipient #${recipientId}: reason: [${code}] ${reason}`);

        redis.removeListener('message', handleMessage);
        listenerCounts[recipientId] -= 1;
        console.debug(`Removed listener for channel #${recipientId}, total # of listeners: ${listenerCounts[recipientId]}`);

        if (listenerCounts[recipientId] === 0) {
            delete listenerCounts[recipientId];
            redis.unsubscribe(recipientId);
            console.debug(`Unsubscribed from channel #${recipientId}`)
        }
    })

    // TODO add heartbeats
});
