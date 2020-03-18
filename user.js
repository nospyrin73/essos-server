class User {
    constructor(username/*, password*/, socket) {
        this.username = username;
        //this.password = password;
        this.socket = socket; // EssosSocket
        
        // has to be an object cuz arrays become read only
        // when passed over IPC (electron.remote)
        this.contacts = {}; 
    }
}

module.exports = User;
