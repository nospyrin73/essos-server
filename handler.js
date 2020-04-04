const { EssosProtocol, Response } = require('./essos-protocol');

let handlers = {
    '/login': login,
    '/find-user': findUser,
    '/join-channel': joinChannel,
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
    let isFound = false;

    users.forEach(user => {
        if (!isFound && user.username === username) {
            user.essSocket = socket;
            respond(socket, '/login', 'success', null, user);

            isFound = true;
            console.log(`${user.username} logged in.`);
        }
    });

    /* ------------------ */
    /* POPULATE DATA */
    // to-do: replace with registration code

    if (!isFound) {
        let user = {
            username,
            password: '',
            channels: [],
            essSocket: socket
        };

        users.push(user);
        respond(socket, '/login', 'success', null, user);
        console.log(`${user.username} logged in.`);
    }
    /* ------------------ */

    // to-do: respond with err
    return;
}

function findUser(username) {
    let user;

    users.forEach(elem => {
        if (elem.username === username) {
            user = elem
        }
    });

    return user;
}

function joinChannel(content, socket) {
    // to-do: refactor
    let initiator;
    let target = [];
    let id = content.id || null;


    users.forEach(user => {
        if (user.username === content.thisUser) {
            initiator = user;
        } else if (user.username === content.otherParty) { //|| content.otherParty.includes(user)
            target.push(user);
        }
    });

    if (!initiator || target.length === 0) { // if either parties aren't found
        // to-do: respond with err
        console.log(`Didn't find someone: `);
        console.dir(initiator);
        console.dir(target);
    }

    // to-do: check if channel already exists between parties if private
    let doesExist = false;
    let channel;

    if (id) {
        channels.forEach(c => {
            if (c.id === id) {
                channel = c;
                doesExist = true;

                target.forEach(t => {
                    t.channels.push({id: c.id, name: c.name});
                    c.participants.push(t);
                });
            }
        });
    }

    if (!doesExist) {
        channel = createChannel([initiator, ...target], content.name, content.access);
        // register the channel in the db
        [initiator, ...target].forEach(user => {
            user.channels.push({ id: channel.id, name: channel.name });
        });
        channels.push(channel);
    }



    // to-do: send a message to other targets as well
    respond(socket, '/join-channel', 'success', null, { channel, channels: matchChannels(initiator.username) });
}

function createChannel(participants, name, access) {
    // to-do: refactor
    let channelID = Math.floor(Math.random() * 1000); // to-do: check if ID exists

    // remove extra data to avoid circular references
    let strippedParticipants = participants.map(participant => {
        return { username: participant.username }
    });

    return new Channel(channelID, strippedParticipants, name, access);
}

function matchChannels(username) {
    let user = findUser(username);
    let userChannels = [];

    user.channels.forEach(userChannel => {
        channels.forEach(channel => {
            if (userChannel.id === channel.id) userChannels.push(channel);
        });
    });

    return userChannels;
}

class Channel {
    constructor(id, participants, name, access) {
        this.id = id;
        this.participants = participants;
        this.access = access || 'private';
        this.name = '';
        participants.forEach(participant => {
            this.name += participant.username + ' - ';
        })
        this.messages = [];
    }
}


function broadcastMessage(content) {
    let { receiver } = content;

    channels.forEach(channel => {
        if (channel.id === receiver) {
            sendMessage(content, channel);
        };
    });
}


function sendMessage(message, channel) {
    // to-do: refactor dis plssssssss
    channel.messages.push(message);

    channel.participants.forEach(participant => {
        users.forEach(user => {
            if (participant.username === user.username) {
                respond(user.essSocket, '/update-chat', 'success', null, { channel, channels: matchChannels(participant.username) });
            }
        });
    });
}

module.exports = {
    handle
}
