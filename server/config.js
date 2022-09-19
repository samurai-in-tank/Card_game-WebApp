class Player {
  constructor(nickname, cur_room) {
    this.nickname = nickname;
    this.cur_room = cur_room;
    this.seat = -1;
    this.ready = false;
    this.hand = [];
  }
  leaveRoom() {
    this.seat = -1;
    this.cur_room = "waiting room";
  }
  reset() {
    this.hand = [];
    this.ready = false;
  }
}
let RoomPlayers = 1;
let user_count = 0;
let game_state = { WAITING: 0,  PLAYING: 1, };
class Game {
  constructor() {
    this.state = game_state.WAITING;
    this.readyCount = 0;
    this.deck = this.prepareDeck();
    this.cur_order_idx = -1;
    this.round = -1;
  }
  isOneLeft() {
    let cnt = 0;
    for (let i = 0; i < this.order.length; i++) if (this.order[i]) cnt++;
    return cnt <= 1;
  }
  start(roomData) {
    this.state = game_state.PLAYING; this.round++;
    this.order = new Array(8).fill(false);
    this.cur_order = new Array(8).fill(-1);
    for (const [sid, userData] of Object.entries(roomData.sockets))  if (userData.ready) this.order[userData.seat] = true;
    for (let i = 0; i < this.order.length; i++) {
      if (this.order[i]) this.cur_order[i] = 1;
      else this.cur_order[i] = -1;
    }
    this.cur_order_idx = Math.floor(Math.random() * 8);
    while (this.cur_order[this.cur_order_idx] < 1) this.cur_order_idx = Math.floor(Math.random() * 8);
    // MIX CARDS
    this.deck = this.mix(this.deck);
  }
  end() {
    this.state = game_state.WAITING;
    this.readyCount = 0;
    delete this.order;
    delete this.cur_order;
    delete this.last;
  }
  prepareDeck() {
    let cards = new Array(80);
    let i = 0;
    for (let card = 12; card >= 1; card--) {
      for (let cnt = card; cnt >= 1; cnt--) {
        cards[i] = card;
        i++;
      }
    }
    cards[i++] = 13;
    cards[i] = 13;
    return cards;
  }
  nextPlayer(selected_card)
  {
    if (!this.cur_order) return;
    this.cur_order_idx = (this.cur_order_idx + 1) % this.cur_order.length;
    while (this.cur_order[this.cur_order_idx] < 1) this.cur_order_idx = (this.cur_order_idx + 1) % this.cur_order.length;
    // UPDATING FIELD
    if (Object.keys(selected_card).length > 0) {
      this.last = selected_card;
      let count = 0;
      for (const [card, val] of Object.entries(this.last)) {
        if (card != 13) this.last.num = card;
        count += val;
      }
      this.last.count = count;
    }
    let still_playing = 0;
    for (let i = 0; i < this.cur_order.length; i++) if (this.cur_order[i] == 1) still_playing++;
    if (still_playing == 1) return this.nextRound();
  }

  updateOrder(omit_i) {
    this.order[omit_i] = false;
    this.cur_order[omit_i] = -1;
  }
  nextRound() {
    for (let i = 0; i < this.order.length; i++) {
      if (this.order[i]) this.cur_order[i] = 1;
      else this.cur_order[i] = -1;
    }
    delete this.last; return true;
  }
  mix(array) {
    let counter = array.length;
    while (counter > 0) {
      let index = Math.floor(Math.random() * counter); counter--;
      let temp = array[counter];
      array[counter] = array[index];
      array[index] = temp;
    } return array;
  }
}
let roomsInfo = { roomNumber: 0, rooms: { open: {}, hide: {} } };
module.exports = { Player, game_state, Game, user_count, RoomPlayers, roomsInfo};
