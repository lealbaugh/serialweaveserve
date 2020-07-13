const fs = require("fs");
const express = require("express");
const socketIO = require("socket.io");
const path = require("path");

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "index.html");
const BROADCAST_FORM = path.join(__dirname, "broadcast.html");

const SAVE_FORM = path.join(__dirname, "save.html");

const server = express()
	.use(express.urlencoded()) // broadcast form sends data as url encoded
	.get("/pickData", (req, res) => jsonResponse(res))
	.get("/broadcast", (req, res) => res.sendFile(BROADCAST_FORM))
	.post("/broadcast", sendBroadcast)
	.get("/save", (req, res) => res.sendFile(SAVE_FORM))
	.post("/save", manualSave)
	.get("/reallyactuallynewdraft", function(req, res) {
		newdraft();
		res.json({ message: "ok" });
	})
	.use((req, res) => res.sendFile(INDEX))
	.listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = socketIO(server);

io.on("connection", function(socket) {
	// console.log('Client connected');
	socket.emit("initData", {
		draft: draft,
		warps: threads,
		wefts: picks,
		patterns: patterns,
		lineNumber: lineNumber,
	});
	socket.on("disconnect", function() {
		// console.log('Client disconnected');
	});
	socket.on("reconnect", function() {
		socket.emit("initData", {
			draft: draft,
			warps: threads,
			wefts: picks,
			patterns: patterns,
			lineNumber: lineNumber,
		});
	});
	socket.on("threadChange", function(data) {
		// console.log("threadChange");
		var success = false;
		try {
			for (var i = 0; i < data.length; i++) {
				draft[data[i].line][data[i].thread] = data[i].state;
			}
			success = true;
		} catch (error) {
			console.error(error);
		}
		if (success) {
			socket.broadcast.emit("threadChange", data);
		}
	});
	socket.on("message", function(msg) {
		console.log(msg);
	});
});

// setInterval(() => io.emit('refresh', {pick: currentPick}), 5000);
// setInterval(() => io.emit("refresh", { draft: draft }), 5000);

var draft = [];
var threads = 40;
var picks = 40;
var lineNumber = 0;

var patterns = require("./patterns.json");
var history = require("./history.json");
var memory = require("./memory.json");

function sendBroadcast(req, res) {
	io.emit("announcement", { content: req.body.message });
	// stay on the broadcast form
	res.sendFile(BROADCAST_FORM);
}
function manualSave(req, res) {
	console.log("manual save");
	saveDraft();
  res.sendFile(SAVE_FORM);
}

function jsonResponse(res) {
	var currentPick = draft[0];
	res.json({ pick: currentPick });
	archivePick();
	lineNumber++;
	io.emit("nextPick", { draft: draft, lineNumber: lineNumber });
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
	lineNumber = 0;
	populateDraft();
	io.emit("initData", {
		draft: draft,
		warps: threads,
		wefts: picks,
		patterns: patterns,
		lineNumber: lineNumber,
	});
}

function populateDraft() {
	// draft.push(makeAllWefts(line));
	for (var line = 0; line < picks; line++) {
		draft.push(makeTabbyPick(line));
	}
	// draft.push(makeAllWarps(line));
}

function makeAllWarps(line) {
	var pick = [];
	for (var i = 0; i < threads; i++) {
		pick.push(1);
	}
	return pick;
}

function makeAllWefts(line) {
	var pick = [];
	for (var i = 0; i < threads; i++) {
		pick.push(0);
	}
	return pick;
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

function saveDraft() {
	console.log("saving");
	memory.draft = draft;
	memory.lineNumber = lineNumber;
	fs.writeFile("memory.json", JSON.stringify(memory), function(err) {
		if (err) {
			console.log(err);
		}
	});
}

if (memory.threads) {
	threads = memory.threads;
}
if (memory.picks) {
	picks = memory.picks;
}

if (memory.draft && memory.draft.length >= picks) {
	draft = memory.draft;
	lineNumber = memory.lineNumber;
} else {
	populateDraft();
}

// save every five minutes -- this is for server sleep
setInterval(saveDraft, 300000);
