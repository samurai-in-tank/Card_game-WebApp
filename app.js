var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var cors = require("cors");
let {
  Player,
  game_state,
  Game,
  user_count,
  connectNumber,
  roomsInfo,
} = require("./server/config");
var port = process.env.PORT || 8080;
app.use(express.static(__dirname + "/src"));
app.get("/", (req, res) => { res.sendFile(__dirname + "/src/index.html"); });
app.get("/help", (req, res) => { res.sendFile(__dirname + "/src/help.html"); });
app.get(`/room/:roomName`, cors(), (req, res, next) => {
  if ( roomsInfo.rooms.open[req.params.roomName] || roomsInfo.rooms.hide[req.params.roomName] ) {
    res.sendFile(__dirname + "/src/room.html");
  } else next();
});
  //ERROR HANDLING
app.use((req, res, next) => {
  var err = new Error("Not Found");
  err.status = 404;
  return next(err);
});
if (app.get("env") === "development") {
  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    return res.sendFile(__dirname + "/src/fourOfour.html");
  });
}
io.on("connection", (socket) => {
  user_count++;
  socket.userData = new Player("Guest" + connectNumber, "main room");
  connectNumber++;
  socket.join("waiting room");
  io.to("waiting room").emit( "refresh waiting room", socket.userData, roomsInfo.rooms.open, user_count );
  socket.on("init", () => { socket.emit("update sender", socket.userData); });
  socket.on("set new nickname", (n_nickname, roomId) => {
    socket.userData.nickname = n_nickname;
    if ( roomsInfo.rooms.open.hasOwnProperty(roomId) || roomsInfo.rooms.hide.hasOwnProperty(roomId) ) {
      joinRoom(socket, roomsInfo.rooms, roomId); }
    socket.emit("update sender", socket.userData);
  });
  // CREATE ROOM
  socket.on("create game room", (room_name, hide) => {
    roomsInfo.roomNumber++;
    let idRoom = `${roomsInfo.roomNumber}-${room_name}`;
    joinRoom(socket, roomsInfo.rooms, idRoom, hide);
    socket.emit("connectUrl", `/room/${idRoom}`);
  });
  // ENTERING ROOM
  socket.on("join game room", (roomId) => {
    if (
      roomsInfo.rooms.open.hasOwnProperty(roomId) ||
      roomsInfo.rooms.hide.hasOwnProperty(roomId)
    ) {
      joinRoom(socket, roomsInfo.rooms, roomId);
      socket.emit("connectUrl", `/room/${roomId}`);
    } else {
      socket.emit("alert", "language.noRoom");
      io.to("waiting room").emit( "refresh waiting room", socket.userData, roomsInfo.rooms.open, user_count);
      return;
    }
  });
  socket.on("chat message", (msg) => {
    if (msg !== "") {
      io.to(socket.userData.cur_room).emit( "chat message", socket.userData.nickname, msg);
    }
  });
  // IF READY TO START
  socket.on("ready", () => {
    let room_name = socket.userData.cur_room;
    if (roomsInfo.rooms.open.hasOwnProperty(room_name)) {
      if (socket.userData.ready === true) {
        socket.userData.ready = false;
        roomsInfo.rooms.open[room_name].game.readyCount--;
        syncUserToRoom(socket, roomsInfo.rooms.open);
        io.to(room_name).emit( "refresh game room", roomsInfo.rooms.open[room_name] );
        return;
      }
      if ( roomsInfo.rooms.open[room_name].game.state == game_state.WAITING && !socket.userData.ready ) {
        socket.userData.ready = true;
        roomsInfo.rooms.open[room_name].game.readyCount++;
        syncUserToRoom(socket, roomsInfo.rooms.open);
        io.to(room_name).emit( "refresh game room", roomsInfo.rooms.open[room_name] );
        //START
        if ( Object.keys(roomsInfo.rooms.open[room_name].sockets).length >= 2 && roomsInfo.rooms.open[room_name].game.readyCount == Object.keys(roomsInfo.rooms.open[room_name].sockets).length) {
          io.to(room_name).emit("chat announce", "language.started", "black");
          roomsInfo.rooms.open[room_name].game.start( roomsInfo.rooms.open[room_name] );
          let handlim = Math.floor( 80 / Object.keys(roomsInfo.rooms.open[room_name].sockets).length );
          let cnt = 0;
          for (const [sid, user] of Object.entries( roomsInfo.rooms.open[room_name].sockets )) {
            for (let i = cnt * handlim; i < handlim * cnt + handlim; i++) {
              user.hand.push(roomsInfo.rooms.open[room_name].game.deck[i]); 
              user.pointsReceived = false;
            }
            cnt++;
          }
          // MIXING
          if (roomsInfo.rooms.open[room_name].leaderBoard) {
            let leaderB = roomsInfo.rooms.open[room_name].leaderBoard;
            if ( leaderB[0][3] === "greaterGame" && leaderB[leaderB.length - 1][3] === "greaterPeon" ) {
              roomsInfo.rooms.open[room_name].sockets[leaderB[0][2]].hand.sort( function (a, b) { return a - b; } );
              roomsInfo.rooms.open[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.sort(function (a, b) { return a - b; });
              // CHOOSE CARDS
              let lastTwo = roomsInfo.rooms.open[room_name].sockets[ leaderB[0][2] ].hand.splice(-2);
              let isWitcher = lastTwo.findIndex((val) => { return val === 13; });
              if (isWitcher !== -1) {
                roomsInfo.rooms.open[room_name].sockets[ leaderB[0][2] ].hand.unshift(lastTwo.splice(isWitcher, 1));
                roomsInfo.rooms.open[room_name].sockets[ leaderB[0][2] ].hand.push(lastTwo[0]);
                lastTwo = roomsInfo.rooms.open[room_name].sockets[ leaderB[0][2] ].hand.splice(-2);
              }
              isWitcher = lastTwo.findIndex((val) => { return val === 13; });
              if (isWitcher !== -1) {
                roomsInfo.rooms.open[room_name].sockets[ leaderB[0][2] ].hand.unshift(lastTwo.splice(isWitcher, 1));
                roomsInfo.rooms.open[room_name].sockets[ leaderB[0][2] ].hand.push(lastTwo[0]);
                lastTwo = roomsInfo.rooms.open[room_name].sockets[ leaderB[0][2] ].hand.splice(-2); }
              let firstTwo = roomsInfo.rooms.open[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.splice(0, 2);
              // MIX CARDS
              roomsInfo.rooms.open[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.push(lastTwo[1]);
              roomsInfo.rooms.open[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.push(lastTwo[0]);
              roomsInfo.rooms.open[room_name].sockets[ leaderB[0][2] ].hand.unshift(firstTwo[1]);
              roomsInfo.rooms.open[room_name].sockets[ leaderB[0][2] ].hand.unshift(firstTwo[0]);
              io.to(room_name).emit( "chat announce", "language.swap", "black", roomsInfo.rooms.open[room_name].sockets[leaderB[0][2]].nickname,
                roomsInfo.rooms.open[room_name].sockets[ leaderB[leaderB.length - 1][2] ].nickname );
              io.to(leaderB[0][2]).emit( "chat announce taxs", "language.taxs", "black", `${lastTwo[0]} & ${lastTwo[1]}`, `${firstTwo[0]} & ${firstTwo[1]}` );
              io.to(leaderB[leaderB.length - 1][2]).emit( "chat announce taxs", "language.taxs", "black", `${firstTwo[0]} & ${firstTwo[1]}`, `${lastTwo[0]} & ${lastTwo[1]}` );
            }
            if ( leaderB[1][3] === "lesserGame" && leaderB[leaderB.length - 2][3] === "lesserPeon"  ) {
              roomsInfo.rooms.open[room_name].sockets[leaderB[1][2]].hand.sort( function (a, b) { return a - b; } );
              roomsInfo.rooms.open[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.sort(function (a, b) { return a - b; });
              // CHOOSE CARDS
              let lastOne = roomsInfo.rooms.open[room_name].sockets[ leaderB[1][2] ].hand.splice(-1);
              let isWitcher = lastOne.findIndex((val) => { return val === 13; });
              if (isWitcher !== -1) {
                roomsInfo.rooms.open[room_name].sockets[ leaderB[1][2] ].hand.unshift(lastOne.splice(isWitcher, 1));
                lastOne = roomsInfo.rooms.open[room_name].sockets[ leaderB[1][2] ].hand.splice(-1);
              }
              let firstOne = roomsInfo.rooms.open[room_name].sockets[ leaderB[leaderB.length - 2][2] ].hand.splice(0, 1);
              roomsInfo.rooms.open[room_name].sockets[ leaderB[leaderB.length - 2][2] ].hand.push(lastOne[0]);
              roomsInfo.rooms.open[room_name].sockets[ leaderB[1][2] ].hand.unshift(firstOne[0]);
              io.to(room_name).emit( "chat announce", "language.swap", "black",
                roomsInfo.rooms.open[room_name].sockets[leaderB[1][2]].nickname,
                roomsInfo.rooms.open[room_name].sockets[ leaderB[leaderB.length - 2][2] ].nickname);
              io.to(leaderB[1][2]).emit( "chat announce taxs", "language.taxs", "black", `${lastOne[0]}`, `${firstOne[0]}` );
              io.to(leaderB[leaderB.length - 2][2]).emit( "chat announce taxs", "language.taxs", "black", `${firstOne[0]}`, `${lastOne[0]}` );
            }
          }
          io.to("waiting room").emit( "refresh waiting room", socket.userData, roomsInfo.rooms.open, user_count );
          io.to(room_name).emit( "refresh game room", roomsInfo.rooms.open[room_name] );
        }
      }
    } else if (roomsInfo.rooms.hide.hasOwnProperty(room_name)) {
      if (socket.userData.ready === true) {
        socket.userData.ready = false;
        roomsInfo.rooms.hide[room_name].game.readyCount--;
        syncUserToRoom(socket, roomsInfo.rooms.hide);
        io.to(room_name).emit( "refresh game room", roomsInfo.rooms.hide[room_name] ); return;
      }
      // WAITING ROOM
      if ( roomsInfo.rooms.hide[room_name].game.state == game_state.WAITING && !socket.userData.ready ) {
        socket.userData.ready = true;
        roomsInfo.rooms.hide[room_name].game.readyCount++;
        syncUserToRoom(socket, roomsInfo.rooms.hide);
        io.to(room_name).emit( "refresh game room", roomsInfo.rooms.hide[room_name] );
        // GAME START
        if ( Object.keys(roomsInfo.rooms.hide[room_name].sockets).length >= 2 && roomsInfo.rooms.hide[room_name].game.readyCount == Object.keys(roomsInfo.rooms.hide[room_name].sockets).length) {
          io.to(room_name).emit("chat announce", "language.started", "black");
          roomsInfo.rooms.hide[room_name].game.start( roomsInfo.rooms.hide[room_name] );
          let handlim = Math.floor( 80 / Object.keys(roomsInfo.rooms.hide[room_name].sockets).length );
          let cnt = 0;
          for (const [sid, user] of Object.entries( roomsInfo.rooms.hide[room_name].sockets )) {
            for (let i = cnt * handlim; i < handlim * cnt + handlim; i++) {
              user.hand.push(roomsInfo.rooms.hide[room_name].game.deck[i]); 
              user.pointsReceived = false;
            } cnt++;
          }
          if (roomsInfo.rooms.hide[room_name].leaderBoard) {
            let leaderB = roomsInfo.rooms.hide[room_name].leaderBoard;
            if ( leaderB[0][3] === "greaterGame" && leaderB[leaderB.length - 1][3] === "greaterPeon" ) {
              roomsInfo.rooms.hide[room_name].sockets[leaderB[0][2]].hand.sort( function (a, b) { return a - b; } );
              roomsInfo.rooms.hide[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.sort(function (a, b) { return a - b; });
              // CHOOSE CARD
              let lastTwo = roomsInfo.rooms.hide[room_name].sockets[ leaderB[0][2] ].hand.splice(-2);
              let isWitcher = lastTwo.findIndex((val) => { return val === 13; });
              if (isWitcher !== -1) {
                roomsInfo.rooms.hide[room_name].sockets[ leaderB[0][2] ].hand.unshift(lastTwo.splice(isWitcher, 1));
                roomsInfo.rooms.hide[room_name].sockets[ leaderB[0][2] ].hand.push(lastTwo[0]);
                lastTwo = roomsInfo.rooms.hide[room_name].sockets[ leaderB[0][2] ].hand.splice(-2);
              }
              isWitcher = lastTwo.findIndex((val) => { return val === 13; });
              if (isWitcher !== -1) {
                roomsInfo.rooms.hide[room_name].sockets[ leaderB[0][2] ].hand.unshift(lastTwo.splice(isWitcher, 1));
                roomsInfo.rooms.hide[room_name].sockets[ leaderB[0][2] ].hand.push(lastTwo[0]);
                lastTwo = roomsInfo.rooms.hide[room_name].sockets[ leaderB[0][2] ].hand.splice(-2);
              }
              let firstTwo = roomsInfo.rooms.hide[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.splice(0, 2);
              // MIXING
              roomsInfo.rooms.hide[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.push(lastTwo[1]);
              roomsInfo.rooms.hide[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.push(lastTwo[0]);
              roomsInfo.rooms.hide[room_name].sockets[ leaderB[0][2] ].hand.unshift(firstTwo[1]);
              roomsInfo.rooms.hide[room_name].sockets[ leaderB[0][2] ].hand.unshift(firstTwo[0]);
              io.to(room_name).emit( "chat announce", "language.swap", "black",
                roomsInfo.rooms.hide[room_name].sockets[leaderB[0][2]].nickname, roomsInfo.rooms.hide[room_name].sockets[ leaderB[leaderB.length - 1][2] ].nickname );
              io.to(leaderB[0][2]).emit( "chat announce taxs", "language.taxs", "black", `${lastTwo[0]} & ${lastTwo[1]}`, `${firstTwo[0]} & ${firstTwo[1]}` );
              io.to(leaderB[leaderB.length - 1][2]).emit( "chat announce taxs", "language.taxs", "black", `${firstTwo[0]} & ${firstTwo[1]}`, `${lastTwo[0]} & ${lastTwo[1]}` );
            }
            if ( leaderB[1][3] === "lesserGame" && leaderB[leaderB.length - 2][3] === "lesserPeon" ) {
              roomsInfo.rooms.hide[room_name].sockets[leaderB[1][2]].hand.sort( function (a, b) { return a - b; } );
              roomsInfo.rooms.hide[room_name].sockets[ leaderB[leaderB.length - 1][2] ].hand.sort(function (a, b) { return a - b; });
              // CHOOSE CARD
              let lastOne = roomsInfo.rooms.hide[room_name].sockets[ leaderB[1][2] ].hand.splice(-1);
              let isWitcher = lastOne.findIndex((val) => { return val === 13; });
              if (isWitcher !== -1) {
                roomsInfo.rooms.hide[room_name].sockets[ leaderB[1][2] ].hand.unshift(lastOne.splice(isWitcher, 1));
                lastOne = roomsInfo.rooms.hide[room_name].sockets[ leaderB[1][2] ].hand.splice(-1);
              }
              let firstOne = roomsInfo.rooms.hide[room_name].sockets[ leaderB[leaderB.length - 2][2] ].hand.splice(0, 1);
              // MIXING
              roomsInfo.rooms.hide[room_name].sockets[ leaderB[leaderB.length - 2][2] ].hand.push(lastOne[0]);
              roomsInfo.rooms.hide[room_name].sockets[ leaderB[1][2] ].hand.unshift(firstOne[0]);
              io.to(room_name).emit( "chat announce", "language.swap", "black", roomsInfo.rooms.hide[room_name].sockets[leaderB[1][2]].nickname,
                roomsInfo.rooms.hide[room_name].sockets[
                  leaderB[leaderB.length - 2][2]
                ].nickname);
              io.to(leaderB[1][2]).emit( "chat announce taxs", "language.taxs", "black", `${lastOne[0]}`, `${firstOne[0]}` );
              io.to(leaderB[leaderB.length - 2][2]).emit( "chat announce taxs", "language.taxs", "black", `${firstOne[0]}`, `${lastOne[0]}`);
            }
          }
          io.to(room_name).emit( "refresh game room", roomsInfo.rooms.hide[room_name]);
        }
      }
    }
  });
  socket.on("play", (selected_card) => {
    let room_name = socket.userData.cur_room;
    if (roomsInfo.rooms.open.hasOwnProperty(room_name)) {
      if (roomsInfo.rooms.open[room_name].game.state != game_state.PLAYING) {
        socket.emit("alert", "language.cheat");
        return;
      }
      if (checkOrder(socket, roomsInfo.rooms.open[room_name])) {
        for (const [card, val] of Object.entries(selected_card)) {
          if (val == 0) delete selected_card[card];
        }
        if (Object.keys(selected_card).length == 0) {
          let tmp_idx = roomsInfo.rooms.open[room_name].game.cur_order_idx;
          roomsInfo.rooms.open[room_name].game.cur_order[tmp_idx] = 0;
          let testLastPass = roomsInfo.rooms.open[room_name].game.nextPlayer(selected_card);
          io.to(room_name).emit( "chat announce", "language.passed", "black", socket.userData.nickname );
          io.to(room_name).emit( "refresh game room", roomsInfo.rooms.open[room_name], testLastPass );
        } else if ( checkValidity(socket, roomsInfo.rooms.open[room_name], selected_card) ) {
          if (checkRule(roomsInfo.rooms.open[room_name], selected_card)) {
            updateHand(socket, roomsInfo.rooms.open[room_name], selected_card);
            if ( roomsInfo.rooms.open[room_name].sockets[socket.id].hand.length == 0 ) {
              roomsInfo.rooms.open[room_name].game.updateOrder( socket.userData.seat, room_name );
              // COUNTER
              let obj = roomsInfo.rooms.open[room_name].sockets;
              let leaderBoard = [];
              for (const player in obj) {
                if (
                  obj[player].hand.length === 0 &&
                  !obj[player].pointsReceived &&
                  obj[player].ready
                ) {
                  if (!obj[player].points) {
                    let points = 0;
                    roomsInfo.rooms.open[room_name].game.order.forEach( (val) => { if (val === true) points++; } );
                    obj[player].points = points;
                    obj[player].pointsReceived = true;
                    leaderBoard.push([ obj[player].points, obj[player].nickname,  player]);
                  } else {
                    let points = 0;
                    roomsInfo.rooms.open[room_name].game.order.forEach( (val) => { if (val === true) points++; });
                    obj[player].points += points;
                    obj[player].pointsReceived = true;
                    leaderBoard.push([ obj[player].points, obj[player].nickname, player]);
                  }
                } else if (
                  (obj[player].hand.length > 0 && !obj[player].pointsReceived && !obj[player].points) || !obj[player].ready ) {
                  leaderBoard.push([0, obj[player].nickname, player]);
                } else { leaderBoard.push([ obj[player].points, obj[player].nickname, player]); }
              }
              leaderBoard.sort((a, b) => b[0] - a[0]);
              if (leaderBoard.length === 3) {
                leaderBoard[0].push("greaterGame");
                leaderBoard[1].push("merchant");
                leaderBoard[2].push("greaterPeon");
              } else if (leaderBoard.length > 3 && leaderBoard.length <= 8) {
                leaderBoard.forEach((val, i) => {
                  if (i === 0) val.push("greaterGame");
                  else if (i === 1) val.push("lesserGame");
                  else if (leaderBoard.length - i === 1) val.push("lesserPeon");
                  else if (leaderBoard.length - i === 0) val.push("greaterPeon");
                  else val.push("merchant");
                });
              } else { leaderBoard[0].push("greaterGame"); }
              roomsInfo.rooms.open[room_name].leaderBoard = leaderBoard;
              io.to(room_name).emit( "chat announce", "language.finished", "black", socket.userData.nickname
              );
              if (roomsInfo.rooms.open[room_name].game.isOneLeft()) {
                io.to(room_name).emit("chat announce", "language.ended", "black");
                roomsInfo.rooms.open[room_name].game.end();
                for (const [sid, userData] of Object.entries( roomsInfo.rooms.open[room_name].sockets )) { userData.reset();}
              }
            }
            roomsInfo.rooms.open[room_name].game.nextPlayer(selected_card);
            io.to(room_name).emit( "refresh game room", roomsInfo.rooms.open[room_name], true, socket.userData);
          } else { socket.emit("alert", "language.wrongCard");}
        } else {
          socket.emit("connectUrl", "/");
          socket.emit("alert", "language.roomFull");
        }
      } 
      else { socket.emit("alert", "language.waitTurn");}
    } else if (roomsInfo.rooms.hide.hasOwnProperty(room_name)) {
      if (roomsInfo.rooms.hide[room_name].game.state != game_state.PLAYING) {
        socket.emit("alert", "language.cheat");
        return;
      }
      if (checkOrder(socket, roomsInfo.rooms.hide[room_name])) {
        for (const [card, val] of Object.entries(selected_card)) {
          if (val == 0) delete selected_card[card];
        }
        // PASS
        if (Object.keys(selected_card).length == 0) {
          let tmp_idx = roomsInfo.rooms.hide[room_name].game.cur_order_idx;
          roomsInfo.rooms.hide[room_name].game.cur_order[tmp_idx] = 0;
          let testLastPass = roomsInfo.rooms.hide[room_name].game.nextPlayer(selected_card);
          io.to(room_name).emit( "chat announce", `language.passed`, "black", socket.userData.nickname);
          io.to(room_name).emit( "refresh game room", roomsInfo.rooms.hide[room_name], testLastPass);
        } else if ( checkValidity(socket, roomsInfo.rooms.hide[room_name], selected_card)) {
          if (checkRule(roomsInfo.rooms.hide[room_name], selected_card)) {
            updateHand(socket, roomsInfo.rooms.hide[room_name], selected_card);
            if ( roomsInfo.rooms.hide[room_name].sockets[socket.id].hand.length == 0 ) {
              roomsInfo.rooms.hide[room_name].game.updateOrder(  socket.userData.seat, room_name );
              let leaderBoard = [], obj = roomsInfo.rooms.hide[room_name].sockets;
              for (const player in obj) {
                if (
                  obj[player].hand.length === 0 &&
                  !obj[player].pointsReceived &&
                  obj[player].ready
                ) {
                  if (!obj[player].points) {
                    let points = 0;
                    roomsInfo.rooms.hide[room_name].game.order.forEach( (val) => { if (val === true) points++;});
                    obj[player].points = points;
                    obj[player].pointsReceived = true;
                    leaderBoard.push([ obj[player].points, obj[player].nickname, player]);
                  } else {
                    let points = 0;
                    roomsInfo.rooms.hide[room_name].game.order.forEach( (val) => { if (val === true) points++; });
                    obj[player].points += points;
                    obj[player].pointsReceived = true;
                    leaderBoard.push([ obj[player].points, obj[player].nickname, player]);
                  }
                } else if ( (obj[player].hand.length > 0 && !obj[player].pointsReceived) || !obj[player].ready ) {
                  leaderBoard.push([0, obj[player].nickname, player]);
                } else { leaderBoard.push([ obj[player].points, obj[player].nickname, player, ]); }
              }
              leaderBoard.sort((a, b) => b[0] - a[0]); 
              if (leaderBoard.length === 3) {
                leaderBoard[0].push("greaterGame");
                leaderBoard[1].push("merchant");
                leaderBoard[2].push("greaterPeon");
              } else if (leaderBoard.length > 3 && leaderBoard.length < 8) {
                leaderBoard.forEach((val, i) => {
                  if (i === 0) val.push("greaterGame");
                  else if (i === 1) val.push("lesserGame");
                  else if (leaderBoard.length - i === 1) val.push("lesserPeon");
                  else if (leaderBoard.length - i === 0) val.push("greaterPeon");
                  else val.push("merchant");
                });
              } else {leaderBoard[0].push("greaterGame"); }
              roomsInfo.rooms.hide[room_name].leaderBoard = leaderBoard;
              io.to(room_name).emit( "chat announce", "language.finished", "black", socket.userData.nickname );
              if (roomsInfo.rooms.hide[room_name].game.isOneLeft()) {
                io.to(room_name).emit("chat announce", "language.ended", "black");
                roomsInfo.rooms.hide[room_name].game.end();
                for (const [sid, userData] of Object.entries( roomsInfo.rooms.hide[room_name].sockets)) { userData.reset(); }
              }
            }
            roomsInfo.rooms.hide[room_name].game.nextPlayer(selected_card);
            io.to(room_name).emit( "refresh game room", roomsInfo.rooms.hide[room_name], true, socket.userData);
          } else {socket.emit("alert", "language.wrongCard");}
        } else {socket.emit("alert", "language.cheat");}
      }
      else { socket.emit("alert", "language.waitTurn");}
    }
  });
  socket.on("disconnect", () => {
    user_count--;
    if (roomsInfo.rooms.open.hasOwnProperty(socket.userData.cur_room)) {
      updateRoomDisconnect( socket, socket.userData.cur_room, roomsInfo.rooms.open);
      io.to("waiting room").emit( "refresh waiting room", socket.userData, roomsInfo.rooms.open, user_count);
    } else if (roomsInfo.rooms.hide.hasOwnProperty(socket.userData.cur_room)) { updateRoomDisconnect( socket, socket.userData.cur_room, roomsInfo.rooms.hide);}
  });
});
http.listen(port, () => {
  console.log("Port: " + port);
});
function checkOrder(socket, roomData) {
  if (socket.userData.seat != roomData.sockets[socket.id].seat) return false; 
  if (roomData.game.cur_order_idx != socket.userData.seat) return false;
  return true;
}
function updateHand(socket, roomData, selected_card) {
  let sid = socket.id;
  let room_name = socket.userData.cur_room;
  let hand_map = {};
  for (let i = 0; i < roomData.sockets[sid].hand.length; i++) {
    let card = roomData.sockets[sid].hand[i];
    if (!hand_map[card]) hand_map[card] = 0;
    hand_map[card]++;
  }
  for (const [card, count] of Object.entries(selected_card)) { hand_map[card] -= count;}
  let new_hand = [];
  for (const [card, count] of Object.entries(hand_map)) {
    let m = count;
    while (m-- > 0) new_hand.push(card);
  } roomData.sockets[sid].hand = new_hand;
}

function checkValidity(socket, roomData, selected_card) {
  let sid = socket.id;
  let hand_map = {};
  for (let i = 0; i < roomData.sockets[sid].hand.length; i++) {
    let card = roomData.sockets[sid].hand[i];
    if (!hand_map[card]) hand_map[card] = 0;
    hand_map[card]++;
  }
  for (const [card, count] of Object.entries(selected_card)) {
    if (!hand_map[card]) return false;
    else { if (count > hand_map[card]) return false;}
  } return true;
}
function checkRule(roomData, selected_card) {
  let count = 0;
  for (const [card, val] of Object.entries(selected_card)) { count += val;}
  if (Object.keys(selected_card).length > 2) return false;
  else if (Object.keys(selected_card).length == 2 && !selected_card[13]) return false;
  if (roomData.game.last) {
    if (roomData.game.last.count != count) return false;
    if (Object.keys(selected_card).length == 1) {
      for (const [card, val] of Object.entries(selected_card)) {
        if (roomData.game.last.num - card <= 0) {
          console.log(roomData.game.last.num + " <= " + card);
          return false;
        }
      }
    } else {
      console.log("13 included");
      for (const [card, val] of Object.entries(selected_card)) {
        if (card != 13 && roomData.game.last.num - card <= 0) {  return false; }
      }
    }
    return true;
  } else { return true;}
}

// USER JOINING
function syncUserToRoom(socket, roomObj) {
  if (
    socket.userData.cur_room != "waiting room" &&
    roomObj[socket.userData.cur_room]
  ) {
    if (!roomObj[socket.userData.cur_room].sockets) {
      roomObj[socket.userData.cur_room].sockets = {};
      roomObj[socket.userData.cur_room].sockets[socket.id] = socket.userData;
    } else { roomObj[socket.userData.cur_room].sockets[socket.id] = socket.userData;}
  }
}
function updateRoomDisconnect(socket, room_name, roomsObj) {
  socket.leave(room_name);socket.join("waiting room");
  if (roomsObj[room_name]) {
    roomsObj[room_name].seats[socket.userData.seat] = false;
    delete roomsObj[room_name].sockets[socket.id];
    if (socket.userData.ready) roomsObj[room_name].game.readyCount--;
    if (roomsObj[room_name].game.state == game_state.PLAYING) {
      roomsObj[room_name].game.updateOrder(socket.userData.seat, room_name);
      if (roomsObj[room_name].game.isOneLeft()) {
        io.to(room_name).emit("chat announce", "language.ended", "black");
        roomsObj[room_name].game.end();
        for (const [sid, userData] of Object.entries(
          roomsObj[room_name].sockets
        )) {
          userData.reset();
        }
      }
      if (roomsObj[room_name].game.cur_order_idx == socket.userData.seat) {roomsObj[room_name].game.nextPlayer({});}
      io.to(room_name).emit("refresh game room", roomsObj[room_name]);
    }
    for (const key in roomsObj) {
      if (Object.keys(roomsObj[key].sockets).length <= 0 && key !== room_name) { delete roomsObj[key];}
    }
  }
  socket.userData.reset(); socket.userData.leaveRoom();
  io.to(room_name).emit("refresh game room", roomsObj[room_name]);
  io.to(room_name).emit("chat connection", socket.userData);
}
function joinRoom(socket, roomObj, room_name, hide) {
  socket.leave("waiting room"); socket.join(room_name);
  if (roomsInfo.rooms.open.hasOwnProperty(room_name)) {
    for (let i = 0; i < 8; i++) {
      if (!roomObj.open[room_name].seats[i]) {
        roomObj.open[room_name].seats[i] = true;
        socket.userData.seat = i;
        break;
      }
    }
    if (socket.userData.seat == -1) {
      socket.leave(room_name);
      socket.join("waiting room");
      socket.emit( "refresh waiting room", socket.userData, roomsInfo.rooms.open, user_count);
      socket.emit("connectUrl", "/");
      socket.emit("alert", "language.roomFull");
      return false;
    }
    if (!roomObj.open[room_name].game) roomObj.open[room_name].game = new Game();
    socket.userData.cur_room = room_name;
    syncUserToRoom(socket, roomObj.open);
    io.to("waiting room").emit( "refresh waiting room", socket.userData, roomsInfo.rooms.open, user_count);
    io.to(room_name).emit("refresh game room", roomsInfo.rooms.open[room_name]); 
    io.to(room_name).emit("chat connection", socket.userData);
    socket.emit("update sender", socket.userData);
  } else if (roomsInfo.rooms.hide.hasOwnProperty(room_name)) {
    for (let i = 0; i < 8; i++) {
      if (!roomObj.hide[room_name].seats[i]) {
        roomObj.hide[room_name].seats[i] = true;
        socket.userData.seat = i;
        break;
      }
    }
    if (socket.userData.seat == -1) {
      console.log("room full"); socket.leave(room_name); socket.join("waiting room"); socket.emit("connectUrl", "/"); socket.emit("alert", "language.roomFull");
      return false;
    }
    if (!roomObj.hide[room_name].game) roomObj.hide[room_name].game = new Game();
    socket.userData.cur_room = room_name;
    syncUserToRoom(socket, roomObj.hide);
    io.to(room_name).emit("refresh game room", roomsInfo.rooms.hide[room_name]);
    io.to(room_name).emit("chat connection", socket.userData);
    socket.emit("update sender", socket.userData);
  } else if (hide) {
    if (!roomObj.hide[room_name] || !roomObj.hide[room_name].seats) {
      roomObj.hide[room_name] = {};
      roomObj.hide[room_name].seats = new Array(8).fill(false);
    }
    for (let i = 0; i < 8; i++) {
      if (!roomObj.hide[room_name].seats[i]) {
        roomObj.hide[room_name].seats[i] = true;
        socket.userData.seat = i;
        break;
      }
    }
    if (socket.userData.seat == -1) {
      console.log("room full");
      socket.leave(room_name);
      socket.join("waiting room");
      socket.emit("connectUrl", "/");
      socket.emit("alert", "language.roomFull");
      return false;
    }
    if (!roomObj.hide[room_name].game) roomObj.hide[room_name].game = new Game();
    socket.userData.cur_room = room_name;
    syncUserToRoom(socket, roomObj.hide);
    io.to(room_name).emit("refresh game room", roomsInfo.rooms.hide[room_name]);
    io.to(room_name).emit("chat connection", socket.userData);
    socket.emit("update sender", socket.userData);
  } else {
    if (!roomObj.open[room_name] || !roomObj.open[room_name].seats) {
      roomObj.open[room_name] = {};
      roomObj.open[room_name].seats = new Array(8).fill(false);
    }
    for (let i = 0; i < 8; i++) {
      if (!roomObj.open[room_name].seats[i]) {
        roomObj.open[room_name].seats[i] = true;
        socket.userData.seat = i;
        break;
      }
    }
    if (socket.userData.seat == -1) {
      console.log("room full"); socket.leave(room_name); socket.join("waiting room");
      socket.emit( "refresh waiting room", socket.userData, roomsInfo.rooms.open, user_count);
      socket.emit("connectUrl", "/"); socket.emit("alert", "language.roomFull");
      return false;
    }
    if (!roomObj.open[room_name].game) roomObj.open[room_name].game = new Game();
    socket.userData.cur_room = room_name;
    syncUserToRoom(socket, roomObj.open);
    io.to("waiting room").emit( "refresh waiting room", socket.userData, roomsInfo.rooms.open, user_count);
    io.to(room_name).emit("refresh game room", roomsInfo.rooms.open[room_name]);
    io.to(room_name).emit("chat connection", socket.userData);
    socket.emit("update sender", socket.userData);
  }
}
