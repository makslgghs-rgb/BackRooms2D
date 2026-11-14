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

    encodeStr(str) {
        const bytes = new TextEncoder().encode(str);
        return Uint8Array.of((bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes);
    }

    encodeLen(len) {
        const res = [];
        do {
            let b = len % 128;
            len = Math.floor(len / 128);
            if (len > 0) b |= 128;
            res.push(b);
        } while (len > 0);
        return new Uint8Array(res);
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
                const proto = this.encodeStr('MQTT');
                const flags = Uint8Array.of(0x04, 0x02, 0x00, 0x3c);
                const cid = this.encodeStr('br_soc_' + this.peerId);
                const body = Uint8Array.of(...proto, ...flags, ...cid);
                const rem = this.encodeLen(body.length);
                this.ws.send(Uint8Array.of(0x10, ...rem, ...body));
            };

            this.ws.onmessage = (event) => {
                const buf = new Uint8Array(event.data);
                if (!buf || buf.length < 2) return;
                const firstByte = buf.at(0);
                const type = firstByte >> 4;

                if (type === 2 && buf.at(3) === 0) {
                    const top = this.encodeStr(this.topic);
                    const body = Uint8Array.of(0x00, 0x03, ...top, 0x00);
                    const rem = this.encodeLen(body.length);
                    this.ws.send(Uint8Array.of(0x82, ...rem, ...body));
                    this.announcePresence();
                } else if (type === 3) {
                    try {
                        let pos = 1;
                        while (buf.at(pos) & 128) pos++;
                        pos++;
                        const tLen = (buf.at(pos) << 8) | buf.at(pos + 1);
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
            const top = this.encodeStr(this.topic);
            const pay = new TextEncoder().encode(JSON.stringify(pkt));
            const body = Uint8Array.of(...top, ...pay);
            const rem = this.encodeLen(body.length);
            this.ws.send(Uint8Array.of(0x30, ...rem, ...body));
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
        const req = removed.at(0);
        if (!req || !req.from) return;

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
            this.onlineFriends.set(msg.from.toLowerCase(), {
                username: msg.from,
                roomCode: msg.roomCode,
                lastSeen: Date.now()
            });
            return;
        }

        if (msg.type === 'friend_req' && msg.to === myLower) {
            const alreadyFriend = this.settings.data.friends.some(f => f.name.toLowerCase() === msg.from.toLowerCase());
            const alreadyReq = this.incomingRequests.some(r => r.from.toLowerCase() === msg.from.toLowerCase());
            if (!alreadyFriend && !alreadyReq) {
                this.incomingRequests.push({ from: msg.from, roomCode: msg.roomCode || '' });
                this.showNote(`Запрос в друзья от ${msg.from}!`);
                if (this.onUpdate) this.onUpdate(false);
            }
            return;
        }

        if (msg.type === 'friend_accept' && msg.to === myLower) {
            if (!this.settings.data.friends.some(f => f.name.toLowerCase() === msg.from.toLowerCase())) {
                this.settings.addFriend(msg.from, msg.roomCode || '');
                this.showNote(`${msg.from} принял(а) заявку!`);
                if (this.onUpdate) this.onUpdate(false);
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
