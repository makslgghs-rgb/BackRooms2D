export class P2PNetwork {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.brokers = [
            'wss://://hivemq.com',
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

        this.remotePlayers = new Map();
        this.syncTimer = 0;
        this.pingTimer = 0;
    }

    getTopic() {
        return `backrooms_2d_room_${this.roomCode || 'solo'}`;
    }

    encodeStr(str) {
        const bytes = new TextEncoder().encode(str);
        return Uint8Array.of((bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes);
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
        const flags = Uint8Array.of(0x04, 0x02, 0x00, 0x3c);
        const cid = this.encodeStr(clientId);
        const body = Uint8Array.of(...proto, ...flags, ...cid);
        const rem = this.encodeRemainingLength(body.length);
        return Uint8Array.of(0x10, ...rem, ...body);
    }

    buildSubscribePacket(topic) {
        const top = this.encodeStr(topic);
        const body = Uint8Array.of(0x00, 0x01, ...top, 0x00);
        const rem = this.encodeRemainingLength(body.length);
        return Uint8Array.of(0x82, ...rem, ...body);
    }

    buildPublishPacket(topic, jsonStr) {
        const top = this.encodeStr(topic);
        const pay = new TextEncoder().encode(jsonStr);
        const body = Uint8Array.of(...top, ...pay);
        const rem = this.encodeRemainingLength(body.length);
        return Uint8Array.of(0x30, ...rem, ...body);
    }

    connect(roomCode, isHost = true) {
        this.disconnect();
        this.roomCode = roomCode.trim().toUpperCase();
        this.isHost = isHost;
        this.remotePlayers.clear();

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
        this.roomCode = null;
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
        if (!this.roomCode) return;
        const url = this.brokers.at(this.brokerIndex % this.brokers.length);
        this.statusText = `Подключение (${(this.brokerIndex % this.brokers.length) + 1}/${this.brokers.length})...`;

        try {
            this.ws = new WebSocket(url, 'mqtt');
            this.ws.binaryType = 'arraybuffer';
        } catch {
            this.brokerIndex++;
            setTimeout(() => this.connectToBroker(), 1000);
            return;
        }

        const timeout = setTimeout(() => {
            if (!this.isConnected && this.roomCode) {
                try { this.ws.close(); } catch {}
                this.brokerIndex++;
                this.connectToBroker();
            }
        }, 2500);

        this.ws.onopen = () => {
            this.ws.send(this.buildConnectPacket('br2d_' + this.peerId));
        };

        this.ws.onmessage = (event) => {
            const buf = new Uint8Array(event.data);
            if (!buf || buf.length < 2) return;
            const packetType = buf.at(0) >> 4;

            if (packetType === 2 && buf.at(3) === 0) {
                clearTimeout(timeout);
                this.isConnected = true;
                this.statusText = `Онлайн [${this.roomCode}]`;
                this.ws.send(this.buildSubscribePacket(this.getTopic()));
                this.send('hello', {});
                return;
            }

            if (packetType === 3) {
                try {
                    let pos = 1;
                    while (buf.at(pos) & 128) pos++;
                    pos++;
                    const topicLen = (buf.at(pos) << 8) | buf.at(pos + 1);
                    pos += 2 + topicLen;
                    const text = new TextDecoder().decode(buf.slice(pos));
                    const msg = JSON.parse(text);
                    if (msg && msg.senderId !== this.peerId) {
                        this.handlePacket(msg);
                    }
                } catch {}
            }
        };

        this.ws.onerror = () => {
            clearTimeout(timeout);
            if (!this.isConnected && this.roomCode) {
                this.brokerIndex++;
                setTimeout(() => this.connectToBroker(), 500);
            }
        };

        this.ws.onclose = () => {
            clearTimeout(timeout);
            if (this.roomCode) {
                this.isConnected = false;
                setTimeout(() => this.connectToBroker(), 1500);
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

        if (msg.type === 'entity_escaped' && this.isHost) {
            if (this.callbacks.onEntityEscaped) {
                this.callbacks.onEntityEscaped();
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

        const now = Date.now();
        for (const [id, rp] of this.remotePlayers.entries()) {
            if (now - rp.lastSeen > 12000) {
                this.remotePlayers.delete(id);
                continue;
            }
            rp.x += (rp.targetX - rp.x) * Math.min(1, 14 * dt);
            rp.y += (rp.targetY - rp.y) * Math.min(1, 14 * dt);
        }

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

            if (this.isHost && entity) {
                this.send('entity_sync', {
                    x: Math.round(entity.x),
                    y: Math.round(entity.y),
                    angle: Number(entity.angle.toFixed(2)),
                    state: entity.state,
                    grabbedId: entity.grabbedPlayerId || null
                });
            }
        }

        this.pingTimer += dt;
        if (this.pingTimer >= 25) {
            this.pingTimer = 0;
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(Uint8Array.of(0xc0, 0x00));
            }
        }
    }

    getRemotePlayersList() {
        return Array.from(this.remotePlayers.values());
    }

    drawRemotePlayers(ctx, localPlayer, lighting, world, building) {
        for (const rp of this.remotePlayers.values()) {
            const dx = rp.x - localPlayer.x;
            const dy = rp.y - localPlayer.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 16) {
                const hit = lighting.castRay(localPlayer.x, localPlayer.y, Math.atan2(dy, dx), dist, world, building);
                if (Math.hypot(hit.x - localPlayer.x, hit.y - localPlayer.y) < dist - 14) {
                    continue;
                }
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
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fef08a';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
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
