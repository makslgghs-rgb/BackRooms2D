export class FriendsNetwork {
    constructor(auth, settings, onUpdate = null) {
        this.auth = auth;
        this.settings = settings;
        this.onUpdate = onUpdate;

        this.topic = 'backrooms_2d_social_v1';
        this.peerId = 'soc_' + Math.random().toString(36).substring(2, 10);
        this.ws = null;
        this.localChannel = null;

        this.incomingRequests = [];
        this.onlineFriends = new Map();
        this.myCurrentRoom = null;
        this.statusNote = '';
        this.noteTimer = 0;

        this.init();
    }

    init() {
        if (typeof BroadcastChannel !== 'undefined') {
            this.localChannel = new BroadcastChannel(this.topic);
            this.localChannel.onmessage = (e) => {
                if (e.data && e.data.senderId !== this.peerId) this.handlePacket(e.data);
            };
        }

        try {
            this.ws = new WebSocket('wss://broker.emqx.io:8084/mqtt', 'mqtt');
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                const proto = new TextEncoder().encode('MQTT');
                const cid = new TextEncoder().encode('br_soc_' + this.peerId);
                const bodyLen = 2 + proto.length + 4 + 2 + cid.length;
                const pkt = new Uint8Array(2 + bodyLen);
                pkt[0] = 0x10; pkt[1] = bodyLen;
                pkt[2] = 0; pkt[3] = proto.length; pkt.set(proto, 4);
                pkt.set([0x04, 0x02, 0x00, 0x3c], 4 + proto.length);
                pkt[8 + proto.length] = 0; pkt[9 + proto.length] = cid.length;
                pkt.set(cid, 10 + proto.length);
                this.ws.send(pkt);
            };

            this.ws.onmessage = (event) => {
                const buf = new Uint8Array(event.data);
                if (!buf || buf.length < 2) return;
                const type = buf[0] >> 4;
                if (type === 2 && buf[3] === 0) {
                    const top = new TextEncoder().encode(this.topic);
                    const bLen = 2 + 2 + top.length + 1;
                    const sub = new Uint8Array(2 + bLen);
                    sub[0] = 0x82; sub[1] = bLen; sub[2] = 0; sub[3] = 3;
                    sub[4] = 0; sub[5] = top.length; sub.set(top, 6);
                    this.ws.send(sub);
                    this.announcePresence();
                } else if (type === 3) {
                    try {
                        let pos = 1;
                        while (buf[pos] & 128) pos++;
                        pos++;
                        const tLen = (buf[pos] << 8) | buf[pos + 1];
                        pos += 2 + tLen;
                        const msg = JSON.parse(new TextDecoder().decode(buf.slice(pos)));
                        if (msg && msg.senderId !== this.peerId) this.handlePacket(msg);
                    } catch {}
                }
            };
        } catch {}

        setInterval(() => {
            this.announcePresence();
            const now = Date.now();
            for (const [k, v] of this.onlineFriends.entries()) {
                if (now - v.lastSeen > 15000) {
                    this.onlineFriends.delete(k);
                    if (this.onUpdate) this.onUpdate(false);
                }
            }
        }, 5000);
    }

    sendPacket(data) {
        const me = this.auth.getCurrentUsername();
        if (!me) return;
        const pkt = { senderId: this.peerId, from: me, roomCode: this.myCurrentRoom, ...data };
        if (this.localChannel) this.localChannel.postMessage(pkt);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const top = new TextEncoder().encode(this.topic);
            const pay = new TextEncoder().encode(JSON.stringify(pkt));
            const bLen = 2 + top.length + pay.length;
            const rem = [];
            let l = bLen;
            do { let b = l % 128; l = Math.floor(l / 128); if (l > 0) b |= 128; rem.push(b); } while (l > 0);
            const out = new Uint8Array(1 + rem.length + bLen);
            out[0] = 0x30; out.set(rem, 1);
            out[1 + rem.length] = (top.length >> 8) & 0xff;
            out[2 + rem.length] = top.length & 0xff;
            out.set(top, 3 + rem.length);
            out.set(pay, 3 + rem.length + top.length);
            this.ws.send(out);
        }
    }

    announcePresence() {
        if (this.auth.isLoggedIn()) this.sendPacket({ type: 'presence' });
    }

    sendFriendRequest(targetNick) {
        const clean = targetNick.trim();
        const me = this.auth.getCurrentUsername();
        if (!clean || !me || clean.toLowerCase() === me.toLowerCase()) return;
        this.sendPacket({ type: 'friend_req', to: clean.toLowerCase() });
        this.showNote(`Запрос отправлен: ${clean}`);
    }

    acceptRequest(fromNick) {
        const idx = this.incomingRequests.findIndex(r => r.from.toLowerCase() === fromNick.toLowerCase());
        if (idx === -1) return;
        const removed = this.incomingRequests.splice(idx, 1);
        const req = removed[0];
        if (!req) return;

        if (!this.settings.data.friends.some(f => f.name.toLowerCase() === req.from.toLowerCase())) {
            this.settings.addFriend(req.from, req.roomCode || '');
        }
        this.sendPacket({ type: 'friend_accept', to: req.from.toLowerCase() });
        this.showNote(`${req.from} добавлен(а) в друзья!`);
        if (this.onUpdate) this.onUpdate(true);
    }

    declineRequest(fromNick) {
        this.incomingRequests = this.incomingRequests.filter(r => r.from.toLowerCase() !== fromNick.toLowerCase());
        if (this.onUpdate) this.onUpdate(true);
    }

    handlePacket(msg) {
        const me = this.auth.getCurrentUsername();
        if (!me) return;
        const myLower = me.toLowerCase();

        if (msg.type === 'presence' && msg.from) {
            const key = msg.from.toLowerCase();
            const prev = this.onlineFriends.get(key);
            this.onlineFriends.set(key, {
                username: msg.from,
                roomCode: msg.roomCode,
                lastSeen: Date.now()
            });
            // Перерисовываем только если статус или комната друга реально изменились
            if ((!prev || prev.roomCode !== msg.roomCode) && this.onUpdate) {
                this.onUpdate(false);
            }
            return;
        }

        if (msg.type === 'friend_req' && msg.to === myLower) {
            const alreadyFriend = this.settings.data.friends.some(f => f.name.toLowerCase() === msg.from.toLowerCase());
            const alreadyReq = this.incomingRequests.some(r => r.from.toLowerCase() === msg.from.toLowerCase());
            if (!alreadyFriend && !alreadyReq) {
                this.incomingRequests.push({ from: msg.from, roomCode: msg.roomCode });
                this.showNote(`Запрос в друзья от ${msg.from}!`);
                if (this.onUpdate) this.onUpdate(true);
            }
            return;
        }

        if (msg.type === 'friend_accept' && msg.to === myLower) {
            if (!this.settings.data.friends.some(f => f.name.toLowerCase() === msg.from.toLowerCase())) {
                this.settings.addFriend(msg.from, msg.roomCode || '');
                this.showNote(`${msg.from} принял(а) заявку!`);
                if (this.onUpdate) this.onUpdate(true);
            }
        }
    }

    showNote(text) {
        this.statusNote = text;
        this.noteTimer = 3.5;
    }

    update(dt) {
        if (this.noteTimer > 0) this.noteTimer -= dt;
    }

    drawNotification(ctx, width) {
        if (this.noteTimer <= 0 || !this.statusNote) return;
        ctx.save();
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(`✉ ${this.statusNote}`, width - 24, 104);
        ctx.restore();
    }
}
