class EssosSocket {
    constructor(socket) {
        this._socket = socket;

        this._buffer = ''; // to persistently store unread buffered data
        this.delimiter = '#';
        this._parsing = { // obj currently being parsed
            length: null, // length of the content (minus length header)
            offset: 0, // how far into the content's been read so far
            chunk: ''
        };
            
        this.parsedObjs = [];
    }

    read(chunk) {
        this._buffer += chunk;

        // as long as there's data in the buffer
        while (this._buffer) {
            // if length is not set -> start of a new message
            if (this._parsing.length === null) {
                // --decode the length of the data

                let delimiterPos = this._buffer.indexOf(this.delimiter);
                // string segment representing length from the buffer
                let lengthSeg = this._buffer.slice(0, delimiterPos);
                this._parsing.length = Number.parseInt(lengthSeg);

                // dispose of the length segment
                this._buffer = this._buffer.slice(delimiterPos + 1);
            }

            let isChunkComplete;

            for (; this._parsing.offset < this._parsing.length; this._parsing.offset++) {

                // does the current data set within the buffer
                // fully contain the expected length of content
                isChunkComplete = this._parsing.chunk.length === this._parsing.length;

                // next piece of data to be read is not available in the buffer
                if (!isChunkComplete && this._buffer === '') {
                    // take a step back for whenever that data is
                    // made available to us
                    this._parsing.offset--;
                    
                    return; // *
                }

                this._parsing.chunk += this._buffer[0];
                this._buffer = this._buffer.substr(1);
            }

            // parse the generated JSON string into a JS object
            // and store it for processing
            try {
                let jsonObj = JSON.parse(this._parsing.chunk);
                this.parsedObjs.push(jsonObj);
            } catch (err) { // in case the JSON string is invalid
                console.log(err);
            }


            // at this point, an entire object's been read
            // so reset our marks for any further reading
            this._parsing = {
                length: null,
                offset: 0,
                chunk: ''
            }
        }

        return this.parsedObjs;
    }
    write(data) {
        // loosely check for null/undefined
        if (data == null) return false;

        // ensure input is in object form for JSON
        data = (typeof data === 'object') ? data : { data };

        try {
            let rawMessage = JSON.stringify(data);
            let message = rawMessage.length + this.delimiter + rawMessage;

            this._socket.write(message);

            return true;
        } catch (err) {
            console.log(err);

            return false;
        }
    }

    clear() {
        // should be called after all parsed objects have been handled
        this.parsedObjs = [];
    }
}

class Request {
    constructor(action, body) {
        this.action = action;
        this.body = body;
    }
}

class Response {
    constructor(action, status, body) {
        this.action = action;
        this.status = status;
        this.body = body;
    }
}

module.exports = {
    EssosSocket,
    Request,
    Response
};