const { EssosProtocol, Response } = require('./essos-protocol');
let fs = require('fs');
const jwt = require('jsonwebtoken');

let handlers = {
    'login': login,
    'load': load,
    'load-chat': loadChat,
    'open-direct-message': openDirectMessage,
    'send-message': sendMessage,
    'upload-file' : uploadFile
}


function handle(request, socket) {
    handlers[request.action](request.data, socket);
    // to-do: send back err if no handler
}


const MAXIMUM_NUM_OF_CHANNELS = 1000;

let users = [];
let channels = [];

function respond(action, status, err, data, socket) {
    let response = new Response(action, status, err, data);
    // to-do: handle failed writes
    socket.write(response);
}

function register(data, socket) {
    let { username, password } = data;

    // check if username's already in use
    for (let user of users) {
        if (user.username === username) {
            respond('register', 'fail', 'username already exists!', null, socket);

            return;
        }
    }

    // register new account
    let newUser = {
        username,
        password, // to-do: encode pass
        channels: [],
        listeners: {
            activeChats: {

            }
        }
    };

    users.push(newUser);
    // respond('success', null, newUser, socket);
}

function login(data, socket) {
    let { username, password } = data;

    for (let user of users) {
        if (user.username === username) {
            if (user.password !== password) {
                respond('login', 'fail', 'wrong password', null, socket);

                return;
            }

            let token = jwt.sign({ username }, 'essos-secret', {
                expiresIn: '7d'
            });

            respond('login', 'success', null, { token }, socket);

            return;
        }
    }

    // temp
    register(data, socket);
    login(data, socket);

    // respond('fail', 'username not found', null, socket);

    return;
}

function authRequest(token, socket) {
    try {
        let decoded = jwt.verify(token, 'essos-secret');

        for (let user of users) {
            if (user.username === decoded.username) return user;
        }

        respond('load', 'fail', `authorization failed - user not found!`, null, socket);
    } catch (err) {
        respond('load', 'fail', `authorization failed - invalid token!`, null, socket);

        return null;
    }
}

function load(data, socket) {
    let { token, resources, keep_alive } = data;
    const FAIL_MSG = 'could not load resource(s)';

    let user = authRequest(token, socket);

    if (user) {
        let res = {};

        for (let resource of resources) {
            res[resource] = user[resource];

            if (!res[resource]) {
                respond('load', 'fail', `resource ${resource} not found!`, null, socket);

                return;
            }

            if (keep_alive) {
                user.listeners = user.listeners || {};
                user.listeners[resource] = user.listeners[resource] || [];
                user.listeners[resource].push(socket);
                socket._socket.on('close', () => {
                    user.listeners[resource] = user.listeners[resource].filter((ls) => ls !== socket);
                })
            }
        }

        respond('load', 'success', null, res, socket);

        return;
    }
}


function loadChat(data, socket) {
    let { channel_id, token, keep_alive } = data;

    let user = authRequest(token, socket);

    if (user) {
        for (let channel of channels) {
            if (channel.id === channel_id) {
                respond('load-chat', 'success', null, { channel }, socket);

                if (keep_alive) {
                    let chatListener = channel.id;
                    user.listeners.activeChats[chatListener] = user.listeners.activeChats[chatListener] || [];
                    user.listeners.activeChats[chatListener].push(socket);
                    socket._socket.on('close', () => {
                        user.listeners.activeChats[chatListener] = user.listeners.activeChats[chatListener].filter((ls) => ls !== socket);
                    });
                }

                return;
            }
        }

        respond('load-chat', 'fail', 'channel not found!', null, socket);

        return;
    }
}

function openDirectMessage(data, socket) {
    let user = authRequest(data.token);
    const FAIL_MSG = 'could not open dm';

    if (user.username === data.other) {
        respond('load', 'fail', 'you can\'t add yourself, duh!')

        return;
    }

    if (user) {
        for (let other of users) {
            if (other.username === data.other) {
                let channel = createChannel({
                    creator: user.username,

                    members: [
                        {
                            username: user.username,
                            avatar_url: user.avatar_url
                        },

                        {
                            username: other.username,
                            avatar_url: other.avatar_url
                        }
                    ],

                    messages: [
                        {
                            type: 'init',
                            timestamp: Date.now()
                        }
                    ]
                });

                channels.push(channel);

                let abstractChannel = {
                    id: channel.id,
                    // name: channel.name,
                    // display_image: channel.displayImage
                }

                user.channels = user.channels || [];
                user.channels.push(abstractChannel);
                user.listeners['channels'].forEach(socket => {
                    respond('load', 'success', null, { channels: user.channels }, socket);
                });

                other.channels = other.channels || [];
                other.channels.push(abstractChannel);
                other.listeners['channels'].forEach(socket => {
                    respond('load', 'success', null, { channels: other.channels }, socket);
                });


                respond('open-direct-message', 'success', null, { channel: { id: channel.id } }, socket);

                return;
            }
        }

        respond('load', 'fail', `user ${data.other} not found!`, null, socket);
    }
}

/* types of messages: normal, init, add users, remove users, users leave/join -- or just event duh*/

function createChannel(options) {
    let channel = {};

    let id;
    do {
        id = Math.floor(Math.random() * MAXIMUM_NUM_OF_CHANNELS);
    } while (channels.some(channel => channel.id === id));

    channel.id = id;
    channel.members = options.members || [];
    channel.messages = options.messages || [];

    return channel;
}

function sendMessage(data, socket) {
    let { receiver: channel_id, outgoing: content, token } = data;

    let user = authRequest(token, socket);

    if (user) {
        let channel_index;
        if (user.channels.some((c) => c.id === channel_id)) {
            for (let channel of channels) {
                if (channel.id !== channel_id) continue;

                let message = {
                    sender: user.username,
                    content: content,
                    timestamp: Date.now
                }

                channel.messages.push(message);
                broadcastUpdate(channel);
            }
        }
    }
}

function broadcastUpdate(channel) {
    channel.members.forEach(member => {
        for (let user of users) {
            if (user.username === member.username) {
                user.listeners['channels'].forEach(socket => {
                    respond('load', 'success', null, { channels: user.channels }, socket);
                });
                let active = user.listeners.activeChats[channel.id];
                if (active) {
                    active.forEach(socket => {
                        respond('load-chat', 'success', null, { channel: channel }, socket);
                    });
                }
            }
        }
    });
}

function uploadFile(data, socket) {
    fs.mkdir('dir');
    console.log('dir created...');
    if(err.code == 'EEXIST'){
        console.log('Directory already exists...');
    } else {
        console.log(err);
    }

    var writeStream = fs.createWriteStream(__dirname__ + '/dir/' + data.fileName);
    writeStream.write(data.content);
}

module.exports = {
    handle
}
