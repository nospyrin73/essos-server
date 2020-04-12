const net = require('net');
const { EssosSocket } = require('./essos-protocol');
const { handle } = require('./handler');

let server = net.createServer(socket => {
    // on connection
    
	let essSocket = new EssosSocket(socket);
    let requests = null;
    
    socket.on('data', chunk => {
		requests = essSocket.read(chunk);

        requests.forEach((request) => {
            handle(request, essSocket);
        });

        essSocket.clear();
    });
});

server.listen(1337, 'localhost', () => {
    console.log('Server listening on port 1337...');
});