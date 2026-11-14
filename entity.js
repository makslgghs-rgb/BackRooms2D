import { CONFIG } from './config.js';

export class BackroomsEntity {
    constructor(player) {
        this.x = player.x + 3000;
        this.y = player.y + 3000;
        this.angle = 0;
        this.radius = 18;

        this.state = 'DORMANT';
        this.tactic = 'AMBUSH';
        this.timer = 14.0;
        this.attackCooldown = 0;
        this.animTime = 0;

        this.path = [];
        this.pathTimer = 0;
        this.afterimages = [];
        this.lastKnownPos = null;
        this.ambushSpot = null;
    }

    hasLineOfSight(x1, y1, x2, y2, world, building, lighting) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        if (dist <= 10) return true;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const hit = lighting.castRay(x1, y1, angle, dist, world, building);
        return Math.hypot(hit.x - x1, hit.y - y1) >= dist - 14;
    }

    isInPlayerView(player, lighting) {
        const angleToEntity = Math.atan2(this.y - player.y, this.x - player.x);
        const diff = Math.atan2(
            Math.sin(angleToEntity - player.angle),
            Math.cos(angleToEntity - player.angle)
        );
        return Math.abs(diff) <= lighting.eyeFov * 0.55;
    }

    getThreatLevel(player) {
        if (this.state === 'DORMANT' || this.state === 'STUNNED') return 0;
        if (this.state === 'GRAB') return 1.5;

        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist > 400) return 0;

        const proximity = 1 - dist / 400;
        if (this.state === 'CHASE') return Math.min(1.5, 0.5 + proximity);
        if (this.state === 'STARE' || this.state === 'WAIT_AMBUSH') return Math.min(1.2, 0.35 + proximity * 0.8);
        return proximity * 0.95;
    }

    onPlayerEscaped() {
        this.state = 'STUNNED';
        this.timer = 3.2;
        this.path = [];
    }

    spawnFarAway(player, world, building) {
        const ts = CONFIG.TILE_SIZE;
        const tactics = ['AMBUSH', 'FLANK', 'BACKSTAB'];
        this.tactic = tactics[Math.floor(Math.random() * tactics.length)];

        let baseAngle = player.angle;
        if (this.tactic === 'AMBUSH') {
            baseAngle = player.angle + (Math.random() - 0.5) * 0.7;
        } else if (this.tactic === 'FLANK') {
            const side = Math.random() * 2 >= 1 ? 1 : -1;
            baseAngle = player.angle + side * (Math.PI * 0.5) + (Math.random() - 0.5) * 0.5;
        } else {
            baseAngle = player.angle + Math.PI + (Math.random() - 0.5) * 0.8;
        }

        for (let attempt = 0; attempt !== 45; attempt++) {
            const spread = (attempt / 45) * Math.PI;
            const angle = baseAngle + (Math.random() - 0.5) * spread;
            const dist = 760 + Math.random() * 380;

            const wx = player.x + Math.cos(angle) * dist;
            const wy = player.y + Math.sin(angle) * dist;
            const tx = Math.floor(wx / ts);
            const ty = Math.floor(wy / ts);

            if (!world.isWall(tx, ty) && (!building || !building.isSolid(tx, ty))) {
                this.x = tx * ts + ts / 2;
                this.y = ty * ts + ts / 2;
                this.state = 'STALK';
                this.timer = 18.0;
                this.path = [];
                this.ambushSpot = this.findAmbushCorner(player, world, building);
                this.lastKnownPos = { x: player.x, y: player.y };
                return true;
            }
        }
        return false;
    }

    findAmbushCorner(player, world, building) {
        const ts = CONFIG.TILE_SIZE;
        const aheadX = player.x + Math.cos(player.angle) * 340;
        const aheadY = player.y + Math.sin(player.angle) * 340;
        const baseTx = Math.floor(aheadX / ts);
        const baseTy = Math.floor(aheadY / ts);

        for (let r = 1; r <= 4; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const tx = baseTx + dx;
                    const ty = baseTy + dy;
                    if (world.isWall(tx, ty) || (building && building.isSolid(tx, ty))) continue;

                    const nearWall = world.isWall(tx + 1, ty) || world.isWall(tx - 1, ty) ||
                                     world.isWall(tx, ty + 1) || world.isWall(tx, ty - 1);
                    if (nearWall) {
                        return { x: tx * ts + ts / 2, y: ty * ts + ts / 2 };
                    }
                }
            }
        }
        return null;
    }

    computePath(targetX, targetY, world, building) {
        const ts = CONFIG.TILE_SIZE;
        const startX = Math.floor(this.x / ts);
        const startY = Math.floor(this.y / ts);
        const goalX = Math.floor(targetX / ts);
        const goalY = Math.floor(targetY / ts);

        if (startX === goalX && startY === goalY) {
            this.path = [{ x: targetX, y: targetY }];
            return;
        }

        const open = [{ x: startX, y: startY, g: 0, f: Math.hypot(goalX - startX, goalY - startY), parent: null }];
        const closed = new Set();
        let steps = 0;

        while (open.length !== 0 && steps !== 320) {
            steps++;
            open.sort((a, b) => a.f - b.f);
            const current = open.shift();
            const key = `${current.x},${current.y}`;

            if (current.x === goalX && current.y === goalY) {
                const result = [];
                let curr = current;
                while (curr.parent) {
                    result.unshift({ x: curr.x * ts + ts / 2, y: curr.y * ts + ts / 2 });
                    curr = curr.parent;
                }
                this.path = result;
                return;
            }

            closed.add(key);

            const dirs = [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 }
            ];

            for (const dir of dirs) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                const nKey = `${nx},${ny}`;
                if (closed.has(nKey) || world.isWall(nx, ny)) continue;

                const isBlocked = building && building.isSolid(nx, ny);
                const g = current.g + (isBlocked ? 7 : 1);
                const h = Math.hypot(goalX - nx, goalY - ny);

                const existing = open.find(n => n.x === nx && n.y === ny);
                if (!existing) {
                    open.push({ x: nx, y: ny, g, f: g + h, parent: current });
                } else if (g !== existing.g && Math.min(g, existing.g) === g) {
                    existing.g = g;
                    existing.f = g + h;
                    existing.parent = current;
                }
            }
        }
    }
    followPath(dt, speed, targetX, targetY, world, building) {
        this.pathTimer -= dt;
        if (this.pathTimer <= 0 || this.path.length === 0) {
            this.pathTimer = 0.22;
            this.computePath(targetX, targetY, world, building);
        }

        const nextPoint = this.path.length !== 0 ? this.path.at(0) : { x: targetX, y: targetY };
        const dx = nextPoint.x - this.x;
        const dy = nextPoint.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= 14 && this.path.length !== 0) {
            this.path.shift();
            return true;
        }

        if (dist > 1) {
            this.angle = Math.atan2(dy, dx);
            const nx = this.x + (dx / dist) * speed;
            const ny = this.y + (dy / dist) * speed;

            const ts = CONFIG.TILE_SIZE;
            const tx = Math.floor(nx / ts);
            const ty = Math.floor(ny / ts);
            if (building && building.isSolid(tx, ty)) {
                const struct = building.getAt(tx, ty);
                if (struct) {
                    struct.hp -= 95 * dt;
                    if (struct.hp <= 0) building.remove(tx, ty);
                }
                return false;
            }

            this.x = nx;
            this.y = ny;

            if (Math.random() * 10 <= 4) {
                this.afterimages.push({ x: this.x, y: this.y, alpha: 0.45 });
            }
        }
        return false;
    }

        update(dt, player, input, world, building, lighting, gameTime, struggle, isHost = true) {
        this.animTime += dt;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            this.afterimages[i].alpha -= dt * 1.5;
            if (this.afterimages[i].alpha <= 0) this.afterimages.splice(i, 1);
        }

        // Если мы гость в P2P-комнате — ИИ монстра считает хост, а мы проверяем только захват себя
        if (!isHost) {
            if (this.state === 'GRAB') {
                this.x = player.x - Math.cos(this.angle) * 16;
                this.y = player.y - Math.sin(this.angle) * 16;
                if (!struggle.active) {
                    this.state = 'CHASE';
                }
                return;
            }

            const distToLocal = Math.hypot(player.x - this.x, player.y - this.y);
            if (this.state === 'CHASE' && distToLocal <= this.radius + player.radius + 8 && this.attackCooldown <= 0) {
                this.state = 'GRAB';
                this.attackCooldown = 2.5;
                struggle.startGrab();
            }
            return;
        }

        if (this.state === 'DORMANT') {
            this.timer -= dt;
            if (this.timer <= 0 && !this.spawnFarAway(player, world, building)) {
                this.timer = 4.0;
            }
            return;
        }

        if (this.state === 'STUNNED') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'CHASE';
            }
            return;
        }

        if (this.state === 'GRAB') {
            this.x = player.x - Math.cos(this.angle) * 16;
            this.y = player.y - Math.sin(this.angle) * 16;
            if (!struggle.active) {
                this.despawn(player, 35);
            }
            return;
        }


        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        const canSeePlayer = this.hasLineOfSight(this.x, this.y, player.x, player.y, world, building, lighting);
        const playerLookingAtMe = canSeePlayer && this.isInPlayerView(player, lighting);

        const { dx, dy } = input.getMovementVector();
        const isMoving = Math.hypot(dx, dy) > 0;
        const injuryBonus = player.hp <= 60 ? 90 : 0;
        const noiseMult = player.equipment ? player.equipment.getNoiseMultiplier() : 1.0;
        const noiseRadius = ((player.isSprinting ? 560 : (isMoving ? 210 : 45)) + injuryBonus) * noiseMult;
        const heardPlayer = dist <= noiseRadius;

        const hasLight = typeof player.hasAnyLight === 'function' ? player.hasAnyLight() : player.flashlightOn;
        const sightRadius = hasLight ? 620 : (gameTime.isNight() ? 140 : 450);
        const spottedPlayer = canSeePlayer && dist <= sightRadius;

        if (spottedPlayer || heardPlayer) {
            this.lastKnownPos = { x: player.x, y: player.y };
        }

        if (this.state === 'STALK') {
            if (playerLookingAtMe && dist <= 480) {
                this.state = 'STARE';
                this.timer = 1.1;
                this.angle = Math.atan2(player.y - this.y, player.x - this.x);
                return;
            }

            if (canSeePlayer && dist <= 145) {
                this.state = 'CHASE';
                return;
            }

            if (this.tactic === 'AMBUSH' && this.ambushSpot) {
                const distToSpot = Math.hypot(this.ambushSpot.x - this.x, this.ambushSpot.y - this.y);
                if (distToSpot > 24) {
                    this.followPath(dt, 235 * dt, this.ambushSpot.x, this.ambushSpot.y, world, building);
                } else {
                    this.state = 'WAIT_AMBUSH';
                    this.timer = 16.0;
                }
            } else {
                this.followPath(dt, 215 * dt, player.x, player.y, world, building);
            }
        }

        else if (this.state === 'WAIT_AMBUSH') {
            this.timer -= dt;
            this.angle = Math.atan2(player.y - this.y, player.x - this.x);

            if (playerLookingAtMe && dist <= 460) {
                this.state = 'STARE';
                this.timer = 0.85;
            } else if ((canSeePlayer && dist <= 210) || this.timer <= 0) {
                this.state = 'CHASE';
            }
        }

        else if (this.state === 'STARE') {
            this.angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.timer -= dt;

            if (this.timer <= 0 || dist <= 145 || player.isSprinting) {
                this.state = 'CHASE';
            }
        }

        else if (this.state === 'CHASE') {
            const chaseSpeed = (gameTime.isNight() ? 325 : 305) * dt;

            if (spottedPlayer || heardPlayer) {
                this.followPath(dt, chaseSpeed, player.x, player.y, world, building);
            } else if (this.lastKnownPos) {
                this.followPath(dt, chaseSpeed, this.lastKnownPos.x, this.lastKnownPos.y, world, building);
                if (Math.hypot(this.lastKnownPos.x - this.x, this.lastKnownPos.y - this.y) <= 36) {
                    this.state = 'SEARCH';
                    this.timer = 4.5;
                    this.path = [];
                }
            }

            if (dist <= this.radius + player.radius + 8 && this.attackCooldown <= 0) {
                this.state = 'GRAB';
                this.attackCooldown = 2.5;
                struggle.startGrab();
            }
        }

        else if (this.state === 'SEARCH') {
            this.timer -= dt;
            this.angle += Math.sin(this.animTime * 4) * 2.5 * dt;

            if (spottedPlayer || heardPlayer) {
                this.state = 'CHASE';
                return;
            }

            if (this.timer <= 0) {
                this.despawn(player, 28 + Math.random() * 20);
            }
        }
    }

    despawn(player, nextDelay) {
        this.state = 'DORMANT';
        this.timer = nextDelay;
        this.path = [];
        this.afterimages = [];
        this.lastKnownPos = null;
        this.ambushSpot = null;
        this.x = player.x + 3000;
        this.y = player.y + 3000;
    }

    draw(ctx) {
        if (this.state === 'DORMANT') return;

        const t = this.animTime;

        for (const ghost of this.afterimages) {
            ctx.fillStyle = `rgba(0, 0, 0, ${ghost.alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(ghost.x, ghost.y, 16, 0, Math.PI * 2);
            ctx.fill();
        }

        const jitter = this.state === 'STARE' || this.state === 'GRAB' ? 3.8 : (this.state === 'CHASE' ? 2.2 : 0.8);
        const jx = (Math.random() - 0.5) * jitter * 2;
        const jy = (Math.random() - 0.5) * jitter * 2;

        ctx.save();
        ctx.translate(this.x + jx, this.y + jy);

        for (let i = 0; i !== 9; i++) {
            const a = (i / 9) * Math.PI * 2 + t * 3.5;
            const r = 8 + Math.sin(t * 14 + i * 2) * 6;
            ctx.fillStyle = 'rgba(2, 2, 3, 0.55)';
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 11 + (i % 3) * 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.rotate(this.angle);

        const isAngry = this.state === 'CHASE' || this.state === 'GRAB';
        const glowColor = isAngry ? '#ef4444' : '#ffffff';
        ctx.fillStyle = glowColor;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.arc(8, -6, 2.6, 0, Math.PI * 2);
        ctx.arc(8, 6, 2.6, 0, Math.PI * 2);
        ctx.fill();

        if (this.state === 'STARE' || isAngry) {
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(6, 0, 9, -0.75, 0.75);
            ctx.stroke();
        }

        ctx.restore();
    }
}
