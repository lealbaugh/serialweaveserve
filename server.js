const fs = require("fs");
const express = require("express");
const socketIO = require("socket.io");
const path = require("path");

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "index.html");
const BROADCAST_FORM = path.join(__dirname, "broadcast.html");

const server = express()
  .use(express.urlencoded()) // broadcast form sends data as url encoded
  .get("/pickData", (req, res) => jsonResponse(res))
  .get("/broadcast", (req, res) => res.sendFile(BROADCAST_FORM))
  .post("/broadcast", sendBroadcast)
  .get("/reallyactuallynewdraft", function(req, res) {
    newdraft();
    res.json({ message: "ok" });
  })
  .use((req, res) => res.sendFile(INDEX))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = socketIO(server);

io.on("connection", function(socket) {
  // console.log('Client connected');
  socket.emit("initData", { draft: draft, warps: threads, wefts: picks });
  socket.on("disconnect", function() {
    // console.log('Client disconnected');
  });
  socket.on("threadChange", function(data) {
    draft[data.line][data.thread] = data.state;
    // currentPick[data.thread] = data.state;
    socket.broadcast.emit("threadChange", data);
  });
  socket.on("message", function(msg) {
    console.log(msg);
  });
});

// setInterval(() => io.emit('refresh', {pick: currentPick}), 5000);
// setInterval(() => io.emit("refresh", { draft: draft }), 5000);

var history = [];
var draft = [];
var threads = 40;
var picks = 40;

function sendBroadcast(req, res) {
  io.emit("announcement", { content: req.body.message });
  // stay on the broadcast form
  res.sendFile(BROADCAST_FORM);
}

function jsonResponse(res) {
  var currentPick = draft[0];
  res.json({ pick: currentPick });
  archivePick();
  io.emit("nextPick", { draft: draft });
}

function archivePick() {
  history.push(draft.shift());
  //   then save history to filesystem
  fs.writeFile("history.json", JSON.stringify(history), function(err) {
    if (err) {
      console.log(err);
    }
  });
  //   then generate a new last-line-of-draft based on inverting the previous one
  var invertedPick = [];
  var lastLine = draft[draft.length - 1];
  for (var i = 0; i < lastLine.length; i++) {
    invertedPick[i] = 1 - lastLine[i];
  }
  draft.push(invertedPick);
}

function newdraft(req, res) {
  draft = [];
  populateDraft();
  io.emit("refresh", { draft: draft });
}

function populateDraft() {
  for (var line = 0; line < picks; line++) {
    draft.push(makeTabbyPick(line));
  }
}

function makeTabbyPick(line) {
  var pick = [];
  for (var i = 0; i < threads; i++) {
    // var upDown = (Math.random()<0.5) ? 1 : 0;
    var upDown = i % 2 == line % 2 ? 1 : 0;
    pick.push(upDown);
  }
  return pick;
}
populateDraft();
