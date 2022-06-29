/*
The purpose of a server instance is communicate with clients and the update manager. A server instance will provide clients with messages (including in real time using websockets),
and directs new messages sent by clients to the update manager.

Each server instance runs an instance of "server.js". 

On startup, a server instance will 
1. Connect to the update manager with a websocket to recieve message updates
2. Copy the message list from google cloud storage
3. If necessary, reconcile any messages recieved from the update manager with the message list
4. Start the server/websocket server to allow connections with clients

When a client sends a message to the server instance, the server instance will immediately forward it to the update manager.
When the update manager sends a message to the server instance, the server instance will update all clients with the message.


PROTOCOL

1. Client to server

GET /messages?last_read={number}

response:
{
  message_num: {number},
  messages: [
    {
      message:"{message}",
      time:{number},
      id:{number}
    },
    {
      message:"{message}",
      time:{number},
      id:{number}
    }
  ]
}

POST /messages?operation=send

[body]
{
  message: "{message}"
}


WEBSOCKET

{
  message: "{message}"
}

2. Server to client

WEBSOCKET

{
  message: "<message>",
  id: <id>,
  time: <time>
}

3. Server to update manager and vice versa

outlined in "update-manager.js"

*/

// TODO: terminate connection with update manager if no websockets with client

const express = require('express');
// const path = require(`path`);
const ws = require('ws');

const {Storage} = require('@google-cloud/storage'); // const Storage = require(...).Storage
//const Multer = require('multer');

const storage = new Storage();

const MESSAGE_LIST_PATH = "V0.0/messages.json";
const UPDATE_MANAGER_URL = process.env.UPDATE_MANAGER_URL || "ws://localhost:8081";

const BUCKET_NAME = process.env.GCLOUD_STORAGE_BUCKET || "the_canvas_app_bucket";

const UPDATE_MANAGER_REFRESH = 120000;

/*
// Multer is required to process file uploads and make them available via
// req.files.
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // no larger than 5mb, you can change as needed.
  },
});*/

// A bucket is a container for objects (files).
const bucket = storage.bucket(BUCKET_NAME);

const app = express();

// TODO: implement locking mechanism for async methods

app.use(express.json());
app.use(express.static('views'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/main.html');
});


app.get('/messages', (req, res) => {
  if (messageList === undefined) res.setHeader("Retry-After", "5000").sendStatus(503); // service unavailable
  else {
    let lastRead = parseInt(req.query.last_read);
    if (isNaN(lastRead)) lastRead = 0;

    let m = {
      message_num: messageList.length,
      messages: messageList.slice(lastRead)
    }
    res.send(JSON.stringify(m));
  }
});

app.post('/messages', (req, res) => {
  if (req.query.operation === "send"){
    let m = req.body;
    if (typeof m.message === "string")
      pushMessage(m);
    res.sendStatus (201);
  }
  else res.sendStatus (400);
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});


const wss = new ws.Server({ server });
wss.on('connection', socket => {


  socket.isAlive = true;

  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.on('message', message => { // TODO: implement feedback to notify client of success/failure  

    let m = JSON.parse(message);
    if (typeof m.message === "string")
      pushMessage(m);
  });
});

const REFRESH_INTERVAL = 30000;
setInterval(() => {
  wss.clients.forEach(socket => {
     if (socket.isAlive === false) {
          return socket.terminate();
      }

      socket.isAlive = false;
      socket.ping();
  })
}, REFRESH_INTERVAL);

function pushMessage(m) {
  updateManager.send(JSON.stringify(m));
}

function addMessage(m) {
  messageList.push(m);
  wss.clients.forEach((socket) => {
    socket.send(JSON.stringify(m));
  });
}

const messageList = [];
bucket.file(MESSAGE_LIST_PATH).download().then(value => messageList.push(...JSON.parse(value).messages))
.then(() => {
  console.log("Messages Copied. Size: " + messageList.length);




}); // '...' is the spread syntax

const heartbeat = function() {
    clearTimeout(updateManager.pingTimeout)

    updateManager.pingTimeout = setTimeout(() => {
        updateManager.terminate();
        updateManager = new ws(UPDATE_MANAGER_URL);
    }, UPDATE_MANAGER_REFRESH)
}

let updateManager = new ws(UPDATE_MANAGER_URL);
updateManager.on('message', message => {
  let m = JSON.parse(message);
  if ("message" in m)
    addMessage(m);

  // else 
})

  .on('ping', heartbeat)
  .on('open', heartbeat)
  .on('close', () => {
      clearTimeout(updateManager.pingTimeout)
  });





// TODO: check if messages are valid 
// TODO: on startup, user may not get messages if messageList is not set up yet - FIX (append startup after message initialization)
// TODO: remove this - we dont need this if we are storing everything anyways

//let file = await bucket.file(MESSAGE_LIST_PATH).download();



/*
const client = new ws('ws://localhost:8080');
client.on('message', message => {
    console.log("Client recieved: " + message);
  });
client.on('open', () => {
  // Causes the server to print "Hello"
  

  console.log("Client sending: Hello");
  client.send('Hello');
});
*/