


const server = "";
const updateInterval = 5000;
const refreshInterval = 2000;
var lastRead = 0;

// TODO: make secure with wss
// TODO: implement broken connection check (re open socket) https://medium.com/voodoo-engineering/websockets-on-production-with-node-js-bdc82d07bb9f#:~:text=A%20common%20issue%20when%20you,to%20gracefully%20close%20the%20connection.
// TODO: implement long polling if websockets fail

const socket = new WebSocket((window.location.hostname === "localhost" ? "ws://" : "wss://") + window.location.host ); // for local testing
//const socket = new WebSocket("ws://localhost:8080");
socket.onopen = function (event) { };

socket.onmessage = function(event) {
  let message = JSON.parse(event.data);
  if ('message' in message && 'time' in  message && 'id' in message) addMessage(message);
}



function updateMessages() {
  let req = new XMLHttpRequest();
  req.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
          let json = JSON.parse(this.responseText);
          if (json.message_num !== lastRead) {
            json.messages.every(function (message, index) {return addMessage(message)});
          }
      }
  };
  req.open("GET", server + "/messages" + formatParams({last_read : lastRead}), true);
  req.setRequestHeader('Content-Type', 'application/json');
  req.send();
}

function addMessage(message) {
  if (lastRead + 1 === message.id) {
    const div = document.createElement('div');
    div.className = 'container';

    div.innerHTML = "<p>" + message.message + '</p>\n'
      + '<span class="time">' + new Date(message.time).toLocaleString() + '</span>';

    document.getElementById('messages').appendChild(div);
    resetScroll();   
    lastRead ++; 
    return true;
  } else {
    setTimeout(updateMessages, 5000); // TODO: keep track of how many times this fails
    return false;
  }
}

function extractMessage() {
  let m = new Message (document.getElementById('message').value);
  document.getElementById('message').value = "";
	return m;
}

function sendMessage() {
  socket.send(JSON.stringify(extractMessage()));
}

/*
function sendMessage() {
  var req = new XMLHttpRequest();
  req.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 201) 
        updateMessages();
      
  };
  req.open("POST", server + "/messages?operation=send", true);
  req.setRequestHeader('Content-Type', 'application/json');
  req.send(JSON.stringify(extractMessage()));
}
*/

class Message {
  constructor(message, time, id) {
    this.message = message;
    this.time = time;
    this.id = id;
  }
}

function resetScroll() {
  var messages = document.getElementById("messages");
  messages.scrollTop = messages.scrollHeight;
}

//setInterval(updateMessages, updateInterval);

function formatParams( params ){
  return "?" + Object
        .keys(params)
        .map(function(key){
          return key+"="+encodeURIComponent(params[key])
        })
        .join("&")
}


// socket.close();