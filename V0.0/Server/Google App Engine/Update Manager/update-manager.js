/*
The update manager's purpose is, upon recieving a new message, to A. update the cloud storage and B. notify server instances of an update

There is only one instance of "update-manager.js", who shares a websocket with each instance of "server.js".

Upon recieving a new message from a server instance, the update manager will:
1. Save the message in memory (while associating it with a unique iD)
2. Notify every instance of the message
3. Save the message on cloud storage
4. Notify every instance that the message has been saved on cloud storage

The Update Manager notifies each server instance twice. 
The first notification is to quickly notify server instances of the message.
The second notification occurs because server instance may connect after the first notification, but reads from the cloud before it is updated, thus missing the message.

PROTOCOL

1. Server instance to update manager

{
  message: "<message>"
}

2. Update manager to server instance
a. First notification

{
  message: "<message>",
  id: <id>,
  time: <time>
}

b. Second notification

{
  id: <id>
}


*/

// TODO: check if its faster to just send one notification. Instead, when server instances start up, they will request all messages they missed
// TODO: delete message list - we dont actually need it

const express = require('express');
const ws = require('ws');

const {Storage} = require('@google-cloud/storage'); // const Storage = require(...).Storage
const storage = new Storage();
const BUCKET_NAME = process.env.GCLOUD_STORAGE_BUCKET || "the_canvas_app_bucket";
const bucket = storage.bucket(BUCKET_NAME);

const MESSAGE_LIST_PATH = "V0.0/messages.json";
const messageList = [];

const app = express();
app.use(express.json());

const instances = {
  wss: null,
  num: function() { return this.wss.clients.length }, // TODO: fix (doesnt work)
  send: function(message) {
    this.wss.clients.forEach((socket) => {
      socket.send(message);
    });
  },
}

// Listen to the App Engine-specified port, or 8081 otherwise (8080 for server.js)
const PORT = process.env.PORT || 8081;
const REFRESH_INTERVAL = 60000; // duration to check if clients are still connected

app.get('/status', (req, res) => {
  let status = 
  {
    server_instances: {
      num: instances.num()
    },
    messages: {
      num: messageList.length
    }
  }
  res.send(JSON.stringify(status));
});


function addMessage(message) {
  console.log("New message recieved: " + message)

  if (typeof message === "string") {
    let m = new Message(message, Date.now(), messageList.length + 1);
    messageList.push(m);

    // first notification
    instances.send(JSON.stringify(m));

    const blob = bucket.file(MESSAGE_LIST_PATH);
    const blobStream = blob.createWriteStream(/*{resumable: false}*/); // non-resumable recommended for files < 10MB
    
    //blobStream.on('error', err => { next(err); });
    blobStream.on('finish', () => {
      // TODO: check if success
      // second notification
      instances.send(JSON.stringify({ id: m.id }));
    });

    blobStream.end(JSON.stringify(
      {
        message_num: messageList.length,
        messages: messageList
      }));    
  }
}

class Message {
  constructor(message, time, id) {
    this.message = message;
    this.time = time;
    this.id = id;
  }
}



function initializeMessageList() {
  return bucket.file(MESSAGE_LIST_PATH).download().then(value => messageList.push(...JSON.parse(value).messages))
  .then(() => {
    console.log("Messages Initialized. Size: " + messageList.length)
  }); 
}

function initializeServer() {
  return app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
  });
}

function initializeWSServer(server) {
  const wss = new ws.Server({ server })
  .on('connection', socket => { // TODO: its possible this wont be called if server immediately connects?


    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', message => { // TODO: implement feedback to notify client of success/failure  

      let m = JSON.parse(message);
      if (typeof m.message === "string")
        addMessage(m.message);
    });
  });

  instances.wss = wss;

  setInterval(() => {
    wss.clients.forEach(socket => {
       if (socket.isAlive === false) {
            return socket.terminate();
        }

        socket.isAlive = false;
        socket.ping();
    })
  }, REFRESH_INTERVAL);

  console.log("Websocket server online");
}

initializeMessageList()
  .then(() => initializeServer())
  .then(server => initializeWSServer(server))
  /*.then(() => {
    const client = new ws('ws://localhost:8081');
    client.on('message', message => {
        console.log("Client recieved: " + message);
      });
    client.on('open', () => {
      // Causes the server to print "Hello"
      

      console.log("Client sending");
      client.send(JSON.stringify({message:"hi"}));
    });

})*/;