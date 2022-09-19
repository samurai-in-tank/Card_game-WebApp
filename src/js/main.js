let game_state = { WAITING: 0, PLAYING: 1};
let socket = io();

$(function () {
  let language;
  (function getLanguage() {
    localStorage.getItem("language") == null ? setLanguage("en") : false;
    $.ajax({ url: "/js/language/" + localStorage.getItem("language") + ".json", dataType: "json", async: false, dataType: "json", success: function (lang) { language = lang; }});
  })();
  $("#new-room-create").text(language.btnCreate); $("#set-nickname-lang").text(language.setNickname); $("#form-chatting").text(language.send); $("#message-input").attr("placeholder", language.write);
  $("#chooseLang").text(language.chooseLang); $("#play-btn").text(language.pass); $("#ready-btn").text(language.ready); $("#joinRoomId").text(language.newRoomName);
  $("#joinRoomIdLang").text(language.newRoomName); $("#shareTitle").text(language.shareTit); $("#join").text(language.join); $("#form-chatting-media").text(language.send);
  $("#roomIdShareLang").text(language.shareInvite); $("#close").text(language.close); $("#btnJoin").text(language.join); $("#joinRoom").text(language.btnJoin); $("#info").text(language.info);
  $("#btnCreate").text(language.create); $("#howTo").text(language.howToPlay); $("#create").text(language.create); $("#set-nickname-ok").text(language.save);
  $("#new-room-name-lang").text(language.newRoomName); $("#titleNickModal").text(language.titleNickModal); $("#hideLang").text(language.hide);
  let nickname = localStorage.getItem("localnickname");
  if (nickname) {
    $(".nickname").html(`<div class="nameMedia">${nickname}</div>`);
    socket.emit( "set new nickname", nickname, window.location.href.substring(window.location.href.lastIndexOf("/") + 1));
  } else {
    $("#newName").click();
  } socket.emit("init");
  $("#new-room-create").click(() => {
    const roomName = $("#new-room-name").val();
    const hide = $("#hide").is(":checked");
    if (roomName !== "") {
      socket.emit("create game room", roomName, hide); $("#new-room-name").val("");
    } else {
      $("#noName").slideDown();
      setTimeout(() => { $("#noName").slideUp(); }, 1500);
      return false;
    }
  });
  $("#joinRoom").click(() => {
    const roomName = $("#joinRoomId").val();
    if (roomName !== "") { $("#joinRoomId").val("");
    } else {
      $("#noName").slideDown();
      setTimeout(() => { $("#noName").slideUp(); }, 1500);
      return false;
    }
  });
  $("#set-nickname-ok").click(() => {
    let nickname = $("#set-nickname").val();

    if (nickname !== "") {
      localStorage.setItem("localnickname", nickname);
      socket.emit(
        "set new nickname", nickname, window.location.href.substring( window.location.href.lastIndexOf("/") + 1)
      );
      $(".nickname").html(`<div>${nickname}</div>`);
      $("#set-nickname").val("");
    } else {
      $("#noName").slideDown();
      setTimeout(() => { $("#noName").slideUp(); }, 1500);
      return false;
    }
  });
  $("#form-chatting-media").click(() => {
    if (!/<\/?[a-z][\s\S]*>/i.test($("#message-input-media").val())) {
      socket.emit("chat message", $("#message-input-media").val());
      $("#message-input-media").val("");
      return false;
    } else { $("#message-input-media").val("Not here my friend");}
    return false;
  });
  socket.on("chat message", (nickname, msg) => {
    if (screen.width > 600) {
      $("#chat-messages").append($("<div>").html(`<b>${nickname}:</b> ${msg}`));
      $("#chat-messages").scrollTop($("#chat-messages").prop("scrollHeight"));
    } else {
      $("#chat-messages-media").append( $("<div>").html(`<b>${nickname}:</b> ${msg}`));
      $("#chat-messages-media").scrollTop( $("#chat-messages-media").prop("scrollHeight"));
    }
  });
  $("#ready-btn").on("click", () => {
    if (!$("#ready-btn").hasClass("disabled")) {
      socket.emit("ready");
      if ($("#ready-btn").text() === language.notReady) $("#ready-btn").text(language.ready);
      else $("#ready-btn").text(language.notReady);
    }
  });
  $("#play-btn").on("click", () => {
    if (!$("#play-btn").hasClass("disabled")) socket.emit("play", selected_card);
  });
  socket.on("refresh waiting room", (user, rooms, user_count) => {
    let roomCount = 0;
    $("#room-list").empty();
    for (const [key, room] of Object.entries(rooms)) {
      appendGameRoom(key, Object.keys(room.sockets).length, room.game.state); roomCount++;
    }
    $("#title").html( `${language.title} <br><strong>${roomCount} ${language.room} | ${user_count} ${language.usersOnline}</strong>`);
  });
  socket.on("update sender", (user) => {
    $(".nickname").html(`<div>${user.nickname}</div>`);
    $("#room-title").text(`${language.roomTitle} ${user.cur_room}`).parent().attr("id", `${user.cur_room}`);
    $("#roomIdShare").val(user.cur_room);
  });
  socket.on("refresh game room", (roomData, passed, socketInfo) => {
    if (roomData.game.state == game_state.WAITING) { $("#ready-btn").removeClass("disabled");
    } else {
      $("#ready-btn").addClass("disabled");
      $("#ready-btn").text(language.ready);
    }
    reloadSlots(roomData);
    reloadCards(socket.id, roomData);
    if (passed) reloadField(roomData, socketInfo);
    setPlayable(roomData);
    showPoints(roomData.leaderBoard);
  });
  socket.on("connectUrl", (roomId) => { window.location.href = roomId;});
  socket.on("alert", (msg) => { $("#play-btn").removeClass("disabled"); alert_big(eval(msg));});
  function alert_big(msg) { $("#error-msg-bg").fadeIn(); $("#error-msg").text(msg); setTimeout(() => { $("#error-msg-bg").fadeOut();}, 3000);}
  function appendGameRoom(name, length, state) {
    let str = "";
    if (state == game_state.WAITING) str = language.wait;
    else if (state == game_state.PLAYING) str = language.playing;
    let $newRoom = $( `<div class='p-4 w-100 mt-2 game-room rounded bg-secondary1'><strong>${language.roomTitle}</strong> ${name} <strong>${language.players}</strong> ${length} / 8 <strong>- ${str}</strong></div>`);
    $newRoom.on("click", () => {
      showLoadingText(); socket.emit("join game room", name);
      $("#chat-messages").empty(); $("#chat-messages-media").empty();
    });
    $("#room-list").append($newRoom);
  }
  function showPoints(leaderBoard) {
    $("#statistics").empty(); $("#statistics-media").empty();
    try {
      leaderBoard.forEach((val, i) => {
        let div;
        if (val[3] === "greaterElf") {
          $(`#${val[2]}`).parent().parent().children().eq(0).removeClass();
          $(`#${val[2]}`).parent().parent().children().eq(0).addClass("greaterElf");
          div = $( `<div id=${val[2]} style="font-size: 1.5rem;" class="col w-100 pointsDiv"><i class="gg-crown"></i> ${val[1]}: ${val[0]}</div>`);
        } else if (val[3] === "lesserElf") {
          $(`#${val[2]}`).parent().parent().children().eq(0).removeClass();
          $(`#${val[2]}`).parent().parent().children().eq(0).addClass("lesserElf");
          div = $( `<div id=${val[2]} style="font-size: 1.2rem;" class="col w-100 pointsDiv">${val[1]}: ${val[0]}</div>`);
        } else if (val[3] === "lesserPeon") {
          $(`#${val[2]}`).parent().parent().children().eq(0).removeClass();
          $(`#${val[2]}`).parent().parent().children().eq(0).addClass("lesserPeon");
          div = $(`<div id=${val[2]} style="font-size: 0.8rem;" class="col w-100 pointsDiv">${val[1]}: ${val[0]}</div>`);
        } else if (val[3] === "greaterPeon") {
          $(`#${val[2]}`).parent().parent().children().eq(0).removeClass();
          $(`#${val[2]}`).parent().parent().children().eq(0).addClass("greaterPeon");
          div = $(`<div id=${val[2]} style="font-size: 0.8rem;" class="col w-100 pointsDiv">${val[1]}: ${val[0]}</div>`);
        } else {
          $(`#${val[2]}`).parent().parent().children().eq(0).removeClass();
          $(`#${val[2]}`).parent().parent().children().eq(0).addClass("merchant");
          div = $(`<div id=${val[2]} class="col w-100 pointsDiv">${val[1]}: ${val[0]}</div>`);
        }
        let spaceDiv = $('<div class="w-100"></div>');
        $("#statistics").append(div, spaceDiv);
        $("#statistics-media").append(div, spaceDiv);
      });
    } catch (error) {}
  }
  socket.on("chat connection", (user) => {
    if (screen.width > 600) {
      if (user.seat > -1)
        $("#chat-messages").append( $("<div>").text(user.nickname + language.connected).addClass("font-weight-bold"));
      else
        $("#chat-messages").append($("<div>").text(user.nickname + language.disconnected).addClass("font-weight-bold"));
      $("#chat-messages").scrollTop($("#chat-messages").prop("scrollHeight"));
    } else {
      if (user.seat > -1)
        $("#chat-messages-media").append($("<div>").text(user.nickname + language.connected).addClass("font-weight-bold"));
      else
        $("#chat-messages-media").append($("<div>").text(user.nickname + language.disconnected).addClass("font-weight-bold"));
      $("#chat-messages-media").scrollTop($("#chat-messages-media").prop("scrollHeight"));
    }
  });
  socket.on("chat announce", (msg, color, nickname, nickname1) => {
    let $new_msg;
    if (nickname && nickname1) {$new_msg = $("<div>").text(nickname1 + " " + eval(msg) + " " + nickname);
    } else if (nickname) {$new_msg = $("<div>").text(nickname + " " + eval(msg));
    } else {$new_msg = $("<div>").text(eval(msg));}
    $new_msg.css("color", color); $new_msg.addClass("font-weight-bold");
    if (screen.width > 600) {
      $("#chat-messages").append($new_msg);
      $("#chat-messages").scrollTop($("#chat-messages").prop("scrollHeight"));
    } else {
      $("#chat-messages-media").append($new_msg);
      $("#chat-messages-media").scrollTop($("#chat-messages-media").prop("scrollHeight"));
    }
  });
  socket.on("chat announce taxs", (msg, color, paied, received) => {
    let arrMess = eval(msg);
    let $new_msg = $("<div>").html( `${arrMess[0]} ${paied}<br>${arrMess[1]} ${received}`);
    $new_msg.css("color", color);
    $new_msg.addClass("font-weight-bold");
    if (screen.width > 600) {
      $("#chat-messages").append($new_msg);
      $("#chat-messages").scrollTop($("#chat-messages").prop("scrollHeight"));
    } else {
      $("#chat-messages-media").append($new_msg);
      $("#chat-messages-media").scrollTop($("#chat-messages-media").prop("scrollHeight"));
    }
  });
  function setPlayable(roomData) {
    let cur = -1;
    if (roomData.game.state == game_state.PLAYING)cur = roomData.game.cur_order_idx;
    for (let i = 0; i < 8; i++) {$("#player" + i).parent().removeClass("currentTurn");}
    $("#play-btn").addClass("disabled");
    for (const [sid, userData] of Object.entries(roomData.sockets)) {
      if (cur == userData.seat && sid == socket.id) {
        alert_big(language.yourTurn);
        $("#play-btn").removeClass("disabled");
        $("#player" + cur).parent().addClass("currentTurn");
      } else if (cur == userData.seat) {$("#player" + cur).parent().addClass("currentTurn");}
    }
  }
  function showLoadingText() {
    $("#title").text(language.connecting);$("#room-list").empty();
  }
  function reloadSlots(roomData) {
    for (let i = 0; i < 8; i++) {
      $("#player" + i).parent().removeClass("top");
      $("#player" + i).empty();
    }
    if (roomData.leaderBoard && roomData.game.state === game_state.WAITING) {
      roomData.leaderBoard.forEach((val, i) => {
        $("#player" + i).append($("<div id=" + val[2] + "><b>" + val[1] + "</b></div>"),
          $("<div class='fontMediaSlots'>" + language.cards + " " + roomData.sockets[val[2]].hand.length + "</div>"));
        if (roomData.game.state == game_state.WAITING) {
          if (roomData.sockets[val[2]].ready) {
            $("#player" + i).append($("<div class='fontMediaSlots' style='color:var(--success1);'>" + language.ready + "</div>"));
          } else {
            $("#player" + i).append($("<div class='fontMediaSlots' style='color:var(--alert1);'>" + language.notReady + "</div>"));
          }
        } else {
          if (roomData.sockets[val[2]].ready) {
            if (roomData.sockets[val[2]].hand.length == 0)
              $("#player" + i).append($("<div class='fontMediaSlots' style='color:var(--success1);'>" + language.winner + "</div>"));
          }
        }
      });
    } else {
      for (const [sid, user] of Object.entries(roomData.sockets)) {
        $("#player" + user.seat).append($("<div id=" + sid + "><b>" + user.nickname + "</b></div>"),
          $("<div class='fontMediaSlots'>" + language.cards +  " " + user.hand.length + "</div>"));
        if (roomData.game.state == game_state.WAITING) {
          if (user.ready) {
            $("#player" + user.seat).append($("<div class='fontMediaSlots' style='color:var(--success1);'>" + language.ready + "</div>"));
          } else {
            $("#player" + user.seat).append($("<div class='fontMediaSlots' style='color:var(--alert1);'>" + language.notReady + "</div>"));
          }
        } else {
          if (user.ready) {
            if (user.hand.length == 0)
              $("#player" + user.seat).append($("<div class='fontMediaSlots' style='color:var(--success1);'>" + language.winner + "</div>"));
          }
        }
      }
    }
    for (let i = 0; i < 8; i++) {
      if ($("#player" + i).children().length === 0) {
        $("#player" + i).parent().addClass("top");
        $("#player" + i).append('<i data-toggle="modal" data-target="#shareRoom" class="material-icons" style="font-size:36px">add_circle_outline</i>');
      }
    }
  }

  // CARD SETTINGS

  let selected_card = {};
  let card_colors = [ "elf", "ghoul", "jaskier", "impera", "dijkstra", "zoltan", "vesemir", "triss", "myszowór", "skellen", "letho", "hemdall", "witcher"];
  function reloadCards(sid, roomData) {
    selected_card = {};
    $("#play-btn").text(language.pass).addClass("bg-alert1").removeClass("btn-success");
    let userData = roomData.sockets[sid];
    userData.hand.sort(function (a, b) {return a - b;});
    let actual_card_count = 1;
    $(".selected").promise().done(function () {
        $("#hand").empty();
        for (let i = 0; i < userData.hand.length; i++) {
          let $carddiv;
          if (userData.hand[i] != -1) {
            $carddiv = $(`<div class='cards text-center ${card_colors[userData.hand[i] - 1]}'></div>`);
            $carddiv.on("mouseenter", () => {if (!$carddiv.hasClass("selected")) $carddiv.addClass("cardSel");});
            $carddiv.on("mouseleave", () => {if (!$carddiv.hasClass("selected"))$carddiv.removeClass("cardSel");});
            $carddiv.on("click", () => {
              if (!selected_card[userData.hand[i]]) selected_card[userData.hand[i]] = 0;
              if ($carddiv.hasClass("selected")) {
                selected_card[userData.hand[i]]--;
                if (selected_card[userData.hand[i]] == 0) delete selected_card[userData.hand[i]];
                $carddiv.removeClass("selected");
              } else {
                selected_card[userData.hand[i]]++;
                $carddiv.addClass("selected");
              }
              if (Object.keys(selected_card).length == 0) {
                $("#play-btn").text(language.pass).addClass("bg-alert1").removeClass("bg-success1");
              } else { $("#play-btn").text(language.play).removeClass("bg-alert1").addClass("bg-success1");}
            });
            $("#hand").append($carddiv);
            actual_card_count++;
          }
        }
      });
  }
  function reloadField(roomData, socketInfo) {
    $("#whoPlayed").empty();
    $("#field-section").children().each((i, val) => $(val).removeClass("active").fadeOut(300)).promise().done((elem) => {
        elem.parent().empty();
        if (roomData.game.state == game_state.PLAYING)
          if (roomData.game.last) {
            $("#whoPlayed").text(`${socketInfo.nickname} ${language.placed}`);
            let last_hand = roomData.game.last;
            delete last_hand.num;
            delete last_hand.count;
            let last_array = [];
            for (const [card, count] of Object.entries(last_hand)) {
              let m = count;
              while (m-- > 0) last_array.push(card);
            }
            for (let i = 0; i < last_array.length; i++) {
              let backCard = $("<div class='flip-card-front backCard'>");
              let $carddiv = $( `<div class='flip-card-back text-center fieldCards ${ card_colors[last_array[i] - 1]}'></div>`);
              let parentDiv = $("<div class='flip-card-inner fieldCards' style='display:none;margin:3px;'>");
              parentDiv.append(backCard, $carddiv);
              $("#field-section").append(parentDiv);
            }
            $($(".fieldCards").get().reverse()).each(function (fadeInDiv) {$(this).delay(fadeInDiv * 100).fadeIn(300);});
            $(".fieldCards").promise().done(() => { $(".flip-card .flip-card-inner").addClass("active");});
          }
      });
  }
  $(document).on("keydown", (e) => {
    if (e.keyCode === 13 && $("#id02").css("display") !== "none") {
      e.preventDefault();
      $("#set-nickname-ok").click();
    } else if (e.keyCode === 13) e.preventDefault();
  });
  $("#chatMedia").click(function () {
    $(".chatStatDivMedia").toggleClass("chatDiv");
    $("#chatMedia").toggleClass("chatActive");
  });
});
