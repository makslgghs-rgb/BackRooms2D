export class AuthSystem {
    constructor(onRegistryUpdated = null) {
        this.dbKey = 'backrooms_users_db_v1';
        this.sessionKey = 'backrooms_active_user_v1';
        this.topic = 'backrooms_2d_global_accounts_v1';
        this.onRegistryUpdated = onRegistryUpdated;

        this.users = this.loadUsers();
        this.currentUser = localStorage.getItem(this.sessionKey) || null;
        if (this.currentUser && !this.users[this.currentUser.toLowerCase()]) {
            this.currentUser = null;
        }

        this.peerId = 'auth_' + Math.random().toString(36).substring(2, 10);
        this.ws = null;
        this.localChannel = null;

        this.initGlobalSync();
    }

    loadUsers() {
        try {
            return JSON.parse(localStorage.getItem(this.dbKey)) || {};
        } catch {
            return {};
        }
    }

    saveUsers() {
        localStorage.setItem(this.dbKey, JSON.stringify(this.users));
    }

    mergeUsers(incomingUsers) {
        if (!incomingUsers || typeof incomingUsers !== 'object') return false;
        let changed = false;

        for (const [key, acc] of Object.entries(incomingUsers)) {
            if (!acc || !acc.username || !acc.passHash) continue;
            const cleanKey = key.toLowerCase();
            const existing = this.users[cleanKey];

            // Оставляем самую раннюю регистрацию, чтобы ник нельзя было перехватить
            if (!existing || (acc.createdAt && existing.createdAt && acc.createdAt < existing.createdAt)) {
                this.users[cleanKey] = {
                    username: acc.username,
                    passHash: acc.passHash,
                    createdAt: acc.createdAt || Date.now()
                };
                changed = true;
            }
        }

        if (changed) {
            this.saveUsers();
            if (this.onRegistryUpdated) this.onRegistryUpdated();
        }
        return changed;
    }

    encodeStr(str) {
        const bytes = new TextEncoder().encode(str);
        const out = new Uint8Array(2 + bytes.length);
        out[0] = (bytes.length >> 8) & 0xff;
        out[1] = bytes.length & 0xff;
        out.set(bytes, 2);
        return out;
    }

    encodeRemainingLength(len) {
        const res = [];
        do {
            let byte = len % 128;
            len = Math.floor(len / 128);
            if (len > 0) byte |= 128;
            res.push(byte);
        } while (len > 0);
        return new Uint8Array(res);
    }

    buildConnectPacket(clientId) {
        const proto = this.encodeStr('MQTT');
        const flags = new Uint8Array([0x04, 0x02, 0x00, 0x3c]);
        const cid = this.encodeStr(clientId);
        const bodyLen = proto.length + flags.length + cid.length;
        const remLen = this.encodeRemainingLength(bodyLen);

        const pkt = new Uint8Array(1 + remLen.length + bodyLen);
        pkt[0] = 0x10;
        pkt.set(remLen, 1);
        pkt.set(proto, 1 + remLen.length);
        pkt.set(flags, 1 + remLen.length + proto.length);
        pkt.set(cid, 1 + remLen.length + proto.length + flags.length);
        return pkt;
    }

    buildSubscribePacket(topic) {
        const topicBytes = this.encodeStr(topic);
        const bodyLen = 2 + topicBytes.length + 1;
        const remLen = this.encodeRemainingLength(bodyLen);

        const pkt = new Uint8Array(1 + remLen.length + bodyLen);
        pkt[0] = 0x82;
        pkt.set(remLen, 1);
        pkt[1 + remLen.length] = 0x00;
        pkt[2 + remLen.length] = 0x02;
        pkt.set(topicBytes, 3 + remLen.length);
        pkt[3 + remLen.length + topicBytes.length] = 0x00;
        return pkt;
    }

    buildPublishPacket(topic, jsonStr) {
        const topicBytes = this.encodeStr(topic);
        const payloadBytes = new TextEncoder().encode(jsonStr);
        const bodyLen = topicBytes.length + payloadBytes.length;
        const remLen = this.encodeRemainingLength(bodyLen);

        const pkt = new Uint8Array(1 + remLen.length + bodyLen);
        pkt[0] = 0x30;
        pkt.set(remLen, 1);
        pkt.set(topicBytes, 1 + remLen.length);
        pkt.set(payloadBytes, 1 + remLen.length + topicBytes.length);
        return pkt;
    }
    initGlobalSync() {
        if (typeof BroadcastChannel !== 'undefined') {
            this.localChannel = new BroadcastChannel(this.topic);
            this.localChannel.onmessage = (e) => {
                if (e.data && e.data.senderId !== this.peerId) {
                    this.handleSyncPacket(e.data);
                }
            };
        }

        try {
            this.ws = new WebSocket('wss://broker.emqx.io:8084/mqtt', 'mqtt');
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                this.ws.send(this.buildConnectPacket('br_auth_' + this.peerId));
            };

            this.ws.onmessage = (event) => {
                const buf = new Uint8Array(event.data);
                if (!buf || buf.length < 2) return;
                const packetType = buf[0] >> 4;

                if (packetType === 2 && buf[3] === 0) {
                    this.ws.send(this.buildSubscribePacket(this.topic));
                    // Запрашиваем у сети актуальный список аккаунтов и делимся своим
                    this.broadcastRegistry('sync_req');
                    return;
                }

                if (packetType === 3) {
                    try {
                        let pos = 1;
                        while (buf[pos] & 128) pos++;
                        pos++;
                        const topicLen = (buf[pos] << 8) | buf[pos + 1];
                        pos += 2 + topicLen;
                        const text = new TextDecoder().decode(buf.slice(pos));
                        const msg = JSON.parse(text);
                        if (msg && msg.senderId !== this.peerId) {
                            this.handleSyncPacket(msg);
                        }
                    } catch {}
                }
            };
        } catch {}
    }

    broadcastRegistry(type = 'sync_push') {
        const packet = {
            type,
            senderId: this.peerId,
            users: this.users,
            ts: Date.now()
        };

        if (this.localChannel) {
            this.localChannel.postMessage(packet);
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(this.buildPublishPacket(this.topic, JSON.stringify(packet)));
        }
    }

    handleSyncPacket(msg) {
        if (msg.users) {
            this.mergeUsers(msg.users);
        }
        if (msg.type === 'sync_req' && Object.keys(this.users).length > 0) {
            setTimeout(() => this.broadcastRegistry('sync_push'), 200 + Math.random() * 400);
        }
    }

    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password + '_br_salt_2026');
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    isLoggedIn() {
        return Boolean(this.currentUser);
    }

    getCurrentUsername() {
        return this.currentUser;
    }

    isNicknameTaken(nickname) {
        return Boolean(this.users[nickname.trim().toLowerCase()]);
    }

    async register(nickname, password) {
        const cleanNick = nickname.trim();
        const key = cleanNick.toLowerCase();

        if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]{3,16}$/.test(cleanNick)) {
            return { ok: false, error: 'Ник: 3-16 символов (буквы, цифры, _)' };
        }
        if (password.length < 4) {
            return { ok: false, error: 'Пароль должен быть не короче 4 символов' };
        }
        if (this.users[key]) {
            return { ok: false, error: 'Этот позывной уже занят другим игроком!' };
        }

        const passHash = await this.hashPassword(password);
        this.users[key] = {
            username: cleanNick,
            passHash,
            createdAt: Date.now()
        };

        this.saveUsers();
        this.broadcastRegistry('sync_push');

        this.currentUser = cleanNick;
        localStorage.setItem(this.sessionKey, cleanNick);
        return { ok: true };
    }

    async login(nickname, password) {
        const cleanNick = nickname.trim();
        const key = cleanNick.toLowerCase();
        const user = this.users[key];

        if (!user) {
            return { ok: false, error: 'Аккаунт с таким позывным не найден' };
        }

        const passHash = await this.hashPassword(password);
        if (user.passHash !== passHash) {
            return { ok: false, error: 'Неверный пароль доступа' };
        }

        this.currentUser = user.username;
        localStorage.setItem(this.sessionKey, user.username);
        return { ok: true };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem(this.sessionKey);
    }
}
