export class P2PNetwork {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.brokers = [
            'wss://broker.emqx.io:8084/mqtt',
            'wss://test.mosquitto.org:8081/mqtt'
        ];
        this.brokerIndex = 0;
        this.ws = null;
        this.localChannel = null;

        this.peerId = 'br_' + Math.random().toString(36).substring(2, 10);
        this.roomCode = null;
        this.isHost = true;
        this.isConnected = false;
        this.statusText = 'Офлайн';

        // Удалённые игроки в текущей комнате: Map<peerId, playerData>
        this.remotePlayers = new Map();
        this.syncTimer = 0;
        this.pingTimer = 0;
    }

    getTopic() {
        return `backrooms_2d_room_${this.roomCode || 'solo'}`;
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
        const versionAndFlags = new Uint8Array([0x04, 0x02, 0x00, 0x3c]); // MQTT 3.1.1, CleanSession, KeepAlive 60s
        const cid = this.encodeStr(clientId);
        const bodyLen = proto.length + versionAndFlags.length + cid.length;
        const remLen = this.encodeRemainingLength(bodyLen);

        const pkt = new Uint8Array(1 + remLen.length + bodyLen);
        pkt[0] = 0x10;
        pkt.set(remLen, 1);
        pkt.set(proto, 1 + remLen.length);
        pkt.set(versionAndFlags, 1 + remLen.length + proto.length);
        pkt.set(cid, 1 + remLen.length + proto.length + versionAndFlags.length);
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
        pkt[2 + remLen.length] = 0x01;
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

    connect(roomCode, isHost = true) {
        this.disconnect();
        this.roomCode = roomCode.trim().toUpperCase();
        this.isHost = isHost;
        this.remotePlayers.clear();

        // Локальный канал для мгновенной проверки в двух вкладках браузера
        if (typeof BroadcastChannel !== 'undefined') {
            this.localChannel = new BroadcastChannel(this.getTopic());
            this.localChannel.onmessage = (e) => {
                const msg = e.data;
                if (msg && msg.senderId !== this.peerId) {
                    this.handlePacket(msg);
                }
            };
        }

        this.connectToBroker();
    }

    disconnect() {
        this.isConnected = false;
        this.remotePlayers.clear();
        if (this.localChannel) {
            this.localChannel.close();
            this.localChannel = null;
        }
        if (this.ws) {
            try { this.ws.close(); } catch {}
            this.ws = null;
        }
        this.statusText = 'Офлайн';
    }

    connectToBroker() {
        const url = this.brokers[this.brokerIndex % this.brokers.length];
        this.statusText = `Подключение (${(this.brokerIndex % this.brokers.length) + 1}/${this.brokers.length})...`;

        try {
            this.ws = new WebSocket(url, 'mqtt');
            this.ws.binaryType = 'arraybuffer';
        } catch {
            this.isConnected = true;
            this.statusText = 'Локальная сеть';
            this.send('hello', {});
            return;
        }

        const timeout = setTimeout(() => {
            if (!this.isConnected) {
                try { this.ws.close(); } catch {}
                this.brokerIndex++;
                if (this.brokerIndex < this.brokers.length * 2) {
                    this.connectToBroker();
                } else {
                    this.isConnected = true;
                    this.statusText = 'Локальная сеть';
                    this.send('hello', {});
                }
            }
        }, 4000);

        this.ws.onopen = () => {
            this.ws.send(this.buildConnectPacket('br2d_' + this.peerId));
        };

        this.ws.onmessage = (event) => {
            const buf = new Uint8Array(event.data);
            if (!buf || buf.length < 2) return;
            const packetType = buf[0] >> 4;

            // CONNACK (подтверждение подключения)
            if (packetType === 2 && buf[3] === 0) {
                clearTimeout(timeout);
                this.isConnected = true;
                this.statusText = `Онлайн [${this.roomCode}]`;
                this.ws.send(this.buildSubscribePacket(this.getTopic()));
                this.send('hello', {});
                return;
            }

            // PUBLISH (входящее сообщение от игрока в комнате)
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
                        this.handlePacket(msg);
                    }
                } catch {}
            }
        };

        this.ws.onclose = () => {
            clearTimeout(timeout);
            if (this.isConnected && this.roomCode) {
                this.isConnected = false;
                setTimeout(() => this.connectToBroker(), 2500);
            }
        };
    }

    send(type, data = {}) {
        if (!this.roomCode) return;
        const packet = {
            type,
            senderId: this.peerId,
            ts: Date.now(),
            ...data
        };

        if (this.localChannel) {
            this.localChannel.postMessage(packet);
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(this.buildPublishPacket(this.getTopic(), JSON.stringify(packet)));
        }
    }
    handlePacket(msg) {
        if (msg.type === 'hello') {
            // Если мы хост — отправляем вошедшему игроку полное состояние мира (seed, постройки, ящики, время)
            if (this.isHost && this.callbacks.onRequestWorldSync) {
                this.callbacks.onRequestWorldSync();
            }
            return;
        }

        if (msg.type === 'world_sync' && !this.isHost) {
            if (this.callbacks.onReceiveWorldSync) {
                this.callbacks.onReceiveWorldSync(msg);
            }
            return;
        }

        if (msg.type === 'player_move') {
            const existing = this.remotePlayers.get(msg.senderId);
            if (existing) {
                existing.targetX = msg.x;
                existing.targetY = msg.y;
                existing.angle = msg.angle;
                existing.flashlightOn = msg.flashlightOn;
                existing.color = msg.color;
                existing.name = msg.name;
                existing.hp = msg.hp;
                existing.lastSeen = Date.now();
            } else {
                this.remotePlayers.set(msg.senderId, {
                    id: msg.senderId,
                    x: msg.x,
                    y: msg.y,
                    targetX: msg.x,
                    targetY: msg.y,
                    angle: msg.angle,
                    flashlightOn: msg.flashlightOn,
                    color: msg.color || '#3b82f6',
                    name: msg.name || 'Игрок',
                    hp: msg.hp ?? 100,
                    lastSeen: Date.now()
                });
            }
            return;
        }

        if (msg.type === 'entity_sync' && !this.isHost) {
            if (this.callbacks.onReceiveEntity) {
                this.callbacks.onReceiveEntity(msg);
            }
            return;
        }

        if (msg.type === 'structure_update' && this.callbacks.onStructureUpdate) {
            this.callbacks.onStructureUpdate(msg);
            return;
        }

        if (msg.type === 'box_opened' && this.callbacks.onBoxOpened) {
            this.callbacks.onBoxOpened(msg.boxId);
            return;
        }

        if (msg.type === 'item_dropped' && this.callbacks.onItemDropped) {
            this.callbacks.onItemDropped(msg);
            return;
        }

        if (msg.type === 'item_picked' && this.callbacks.onItemPicked) {
            this.callbacks.onItemPicked(msg.uid);
            return;
        }
    }

    update(dt, player, profile, username, entity) {
        if (!this.roomCode) return;

        // Плавная интерполяция движения других игроков
        const now = Date.now();
        for (const [id, rp] of this.remotePlayers.entries()) {
            if (now - rp.lastSeen > 12000) {
                this.remotePlayers.delete(id);
                continue;
            }
            rp.x += (rp.targetX - rp.x) * Math.min(1, 14 * dt);
            rp.y += (rp.targetY - rp.y) * Math.min(1, 14 * dt);
        }

        // Отправка своих координат и состояния фонарика (15 раз в секунду)
        this.syncTimer += dt;
        if (this.syncTimer >= 0.065) {
            this.syncTimer = 0;
            this.send('player_move', {
                x: Math.round(player.x),
                y: Math.round(player.y),
                angle: Number(player.angle.toFixed(2)),
                flashlightOn: typeof player.hasAnyLight === 'function' ? player.hasAnyLight() : player.flashlightOn,
                color: profile.color,
                name: username,
                hp: Math.round(player.hp)
            });

            // Хост транслирует координаты Сущности остальным игрокам
            if (this.isHost && entity) {
                this.send('entity_sync', {
                    x: Math.round(entity.x),
                    y: Math.round(entity.y),
                    angle: Number(entity.angle.toFixed(2)),
                    state: entity.state
                });
            }
        }

        // MQTT PingReq каждые 25 сек, чтобы сокет не закрывался по таймауту
        this.pingTimer += dt;
        if (this.pingTimer >= 25) {
            this.pingTimer = 0;
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(new Uint8Array([0xc0, 0x00]));
            }
        }
    }

    getRemotePlayersList() {
        return Array.from(this.remotePlayers.values());
    }

    drawRemotePlayers(ctx, localPlayer, lighting, world, building, gameTime) {
        for (const rp of this.remotePlayers.values()) {
            // Скрываем напарников в тумане войны за стенами, если на них не падает свет
            if (!lighting.isPointVisible(rp.x, rp.y, localPlayer, world, building, gameTime)) {
                continue;
            }

            ctx.save();
            ctx.translate(rp.x, rp.y);
            ctx.rotate(rp.angle);

            ctx.fillStyle = rp.color;
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = rp.flashlightOn ? '#fef08a' : '#64748b';
            ctx.fillRect(10, -4, 12, 8);
            ctx.restore();

            ctx.save();
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fef08a';
            ctx.fillText(rp.name, rp.x, rp.y - 24);
            ctx.restore();
        }
    }

    drawStatusHUD(ctx, width) {
        if (!this.roomCode) return;
        ctx.save();
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'right';
        const count = this.remotePlayers.size + 1;
        ctx.fillStyle = this.isConnected ? '#38bdf8' : '#a1a1aa';
        ctx.fillText(`🌐 ${this.statusText} | Игроков: ${count}`, width - 24, 82);
        ctx.restore();
    }
}
