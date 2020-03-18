const { EssosProtocol, Response } = require('./essos-protocol');

let handlers = {
    '/login': login,
    '/find-user': findUser,
    '/join-channel': joinChannel,
    '/open-chat': openChat,
    '/chat-message': broadcastMessage
}

function handle(request, socket) {
    handlers[request.action](request.body, socket);
}

let users = []; // to-do: database

/* 
    Channel: {
        id: n,
        access: 'private' || 'party',
        participants: [User],
        messages: [Message]
    }

    Participant: {
        user: n,
    }

    Message: {
        id: n,
        sender: User,
        channel: n,
        date: Date,
        content: '',
    }

    User: {
        username: '',
        password: '',
        channels: [n]
    }
 */

let channels = [];

function respond(socket, action, status, err, body) {
    let response = new Response(action, status, body);

    socket.write(response);
}

function login(content, socket) {
    let { username /*, password*/ } = content;

    users.forEach(user => {
        if (user.username === username) {
            respond(socket, '/login', 'success', null, user);

            return;
        }
    });

/* ------------------ */
/* POPULATE DATA */ 
// to-do: replace with registration code
    let user = {
        username,
        password: '',
        channels: []
    };
    users.push(user);
/* ------------------ */


    // to-do: respond with err
    return;
}

function findUser(content, socket) {
    let { username } = content;
    users.forEach(user => {
        if (user.username === username) {
            respond(socket, '/find-user', 'success', null, user);
        }
    })
}

function joinChannel(content, socket) {
    // to-do: refactor
    let initiator;
    let target = [];

    users.forEach(user => {
        if (user.username === content.thisUser) {
            initiator = user;
        } else if (content.otherParty.includes(user)) {
            target.push(user);
        }
    });

    if (!initiator || target.length === 0) { // if either parties aren't found
        // to-do: respond with err
    }

    // to-do: check if channel already exists between parties if private

    let channel = createChannel([initiator, ...target]);

    channels.push(channel);



    // to-do: send a response to other targets as well
    respond(socket, '/join-channel', 'success', null, channel);
}

function createChannel(participants /*, access*/) {
    // to-do: refactor
    let channelID = Math.floor(Math.random() * 1000); // to-do: check if ID exists

    return new Channel(channelID, participants /*, access*/);
}

function openChat(content, socket) {
    let { channelID } = content;
    channels.forEach(channel => {
        if (channel.id === channelID) {
            respond(socket, '/open-chat', null, channel);

            return;
        }
    })

    // err
}

function broadcastMessage(content) {
    let { channelID, message } = content;

    channels.forEach(channel => {
        if (channel.id === channelID) {
                sendMessage(message, channel);
            };
    });
}


function sendMessage(message, channel) {
    // to-do: refactor dis plssssssss
    channel.messages.push(message);

    channel.participants.forEach(participant => {
        respond(participants.essSocket, '/update-chat', 'success', null, channel);
    });
}

module.exports = {
    handle
}