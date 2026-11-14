export class TouchControls {
    constructor(canvas, input, callbacks = {}) {
        this.canvas = canvas;
        this.input = input;
        this.callbacks = callbacks;

        this.enabled = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        this.editMode = false;
        this.dragTarget = null;

        this.storageKey = 'backrooms_touch_layout_v1';
        this.layout = this.loadLayout();

        this.stick = { active: false, id: null, startX: 0, startY: 0, currX: 0, currY: 0, maxR: 52 };
        this.aimTouch = { active: false, id: null };
        this.sprintActive = false;
        this.buttons = [];

        this.bindEvents();
    }

    loadLayout() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey));
            return saved && typeof saved === 'object' ? saved : { scale: 1.0, positions: {} };
        } catch {
            return { scale: 1.0, positions: {} };
        }
    }

    saveLayout() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.layout));
    }

    resetLayout() {
        this.layout = { scale: 1.0, positions: {} };
        this.saveLayout();
    }

    startEditMode() {
        this.enabled = true;
        this.editMode = true;
    }

    bindEvents() {
        window.addEventListener('touchstart', (e) => {
            this.enabled = true;
            if (e.target !== this.canvas) return;
            e.preventDefault();

            for (const t of e.changedTouches) {
                const x = t.clientX;
                const y = t.clientY;

                if (this.editMode) {
                    if (x >= window.innerWidth / 2 - 90 && x <= window.innerWidth / 2 + 90 && y >= 20 && y <= 62) {
                        this.editMode = false;
                        this.saveLayout();
                        return;
                    }
                    if (x >= window.innerWidth / 2 - 90 && x <= window.innerWidth / 2 + 90 && y >= 70 && y <= 106) {
                        this.resetLayout();
                        return;
                    }
                    const btn = this.findButtonAt(x, y);
                    if (btn) {
                        this.dragTarget = { id: btn.id, touchId: t.identifier, offX: x - btn.x, offY: y - btn.y };
                    }
                    continue;
                }

                const btn = this.findButtonAt(x, y);
                if (btn) {
                    this.triggerButton(btn.id);
                    continue;
                }

                if (x <= window.innerWidth * 0.45 && !this.stick.active) {
                    this.stick.active = true;
                    this.stick.id = t.identifier;
                    this.stick.startX = x;
                    this.stick.startY = y;
                    this.stick.currX = x;
                    this.stick.currY = y;
                    continue;
                }

                if (!this.aimTouch.active) {
                    this.aimTouch.active = true;
                    this.aimTouch.id = t.identifier;
                    this.input.mouse.x = x;
                    this.input.mouse.y = y;
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!this.enabled || e.target !== this.canvas) return;
            e.preventDefault();

            for (const t of e.changedTouches) {
                if (this.editMode && this.dragTarget && t.identifier === this.dragTarget.touchId) {
                    const nx = Math.max(8, Math.min(window.innerWidth - 60, t.clientX - this.dragTarget.offX));
                    const ny = Math.max(8, Math.min(window.innerHeight - 60, t.clientY - this.dragTarget.offY));
                    this.layout.positions[this.dragTarget.id] = { x: nx, y: ny };
                    continue;
                }

                if (this.stick.active && t.identifier === this.stick.id) {
                    this.stick.currX = t.clientX;
                    this.stick.currY = t.clientY;
                } else if (this.aimTouch.active && t.identifier === this.aimTouch.id) {
                    this.input.mouse.x = t.clientX;
                    this.input.mouse.y = t.clientY;
                }
            }
        }, { passive: false });

        const endTouch = (e) => {
            for (const t of e.changedTouches) {
                if (this.dragTarget && t.identifier === this.dragTarget.touchId) {
                    this.dragTarget = null;
                }
                if (this.stick.active && t.identifier === this.stick.id) {
                    this.stick.active = false;
                    this.stick.id = null;
                }
                if (this.aimTouch.active && t.identifier === this.aimTouch.id) {
                    this.aimTouch.active = false;
                    this.aimTouch.id = null;
                }
            }
        };

        window.addEventListener('touchend', endTouch);
        window.addEventListener('touchcancel', endTouch);
    }
    getMovementVector() {
        if (!this.enabled || this.editMode || !this.stick.active) return { dx: 0, dy: 0 };
        const rawDx = this.stick.currX - this.stick.startX;
        const rawDy = this.stick.currY - this.stick.startY;
        const dist = Math.hypot(rawDx, rawDy);
        if (dist <= 8) return { dx: 0, dy: 0 };

        const clamped = Math.min(dist, this.stick.maxR) / this.stick.maxR;
        return {
            dx: (rawDx / dist) * clamped,
            dy: (rawDy / dist) * clamped
        };
    }

    isSprinting() {
        return this.enabled && this.sprintActive;
    }

    buildLayout(width, height, struggleActive, isDead = false) {
        if (isDead && !this.editMode) {
            const sc = this.layout.scale || 1.0;
            const r = Math.round(25 * sc);
            const rightX = width - 32 - r;
            const baseY = height - 125 - r;

            this.buttons = [
                { id: 'RESTART', label: 'ЗАНОВО', x: width / 2 - 95, y: height / 2 + 55, w: 190, h: 52, rect: true, color: '#ef4444' },
                { id: 'ACT',     label: 'ИСП',    x: rightX - r, y: baseY - r, w: r * 2, h: r * 2, color: '#4ade80' }
            ];
            return;
        }

        if (struggleActive && !this.editMode) {
            this.buttons = [
                { id: 'SPACE', label: 'ВЫРВАТЬСЯ!', x: width / 2 - 95, y: height - 135, w: 190, h: 64, color: '#ef4444' }
            ];
            return;
        }

        const sc = this.layout.scale || 1.0;
        const r = Math.round(25 * sc);
        const step = Math.round(68 * sc);
        const rightX = width - 32 - r;
        const baseY = height - 125 - r;

        const defaults = [
            { id: 'MENU',  label: 'МЕНЮ', x: width - 104, y: 112, w: 84, h: 38, rect: true, color: '#fef08a' },
            { id: 'ACT',   label: 'ИСП',  x: rightX - r, y: baseY - r, w: r * 2, h: r * 2, color: '#4ade80' },
            { id: 'USE',   label: 'E',    x: rightX - step - r, y: baseY - r, w: r * 2, h: r * 2, color: '#fef08a' },
            { id: 'SPRINT',label: 'БЕГ',  x: rightX - r, y: baseY - step - r, w: r * 2, h: r * 2, active: this.sprintActive },
            { id: 'LIGHT', label: 'СВЕТ', x: rightX - step - r, y: baseY - step - r, w: r * 2, h: r * 2 },
            { id: 'BUILD', label: 'СТР',  x: rightX - step * 2 - r, y: baseY - r, w: r * 2, h: r * 2 },
            { id: 'CRAFT', label: 'КРАФТ',x: rightX - step * 2 - r, y: baseY - step - r, w: r * 2, h: r * 2 },
            { id: 'EQUIP', label: 'ШМОТ', x: rightX - step * 3 - r, y: baseY - step - r, w: r * 2, h: r * 2 },
            { id: 'DROP',  label: 'ВЫБР', x: rightX - step * 3 - r, y: baseY - r, w: r * 2, h: r * 2 }
        ];

        this.buttons = defaults.map(btn => {
            const custom = this.layout.positions[btn.id];
            if (custom) {
                btn.x = Math.min(width - btn.w, custom.x);
                btn.y = Math.min(height - btn.h, custom.y);
            }
            return btn;
        });
    }

    findButtonAt(x, y) {
        const pad = 10;
        for (const b of this.buttons) {
            if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) {
                return b;
            }
        }
        return null;
    }

    triggerButton(id) {
        if (id === 'RESTART' && this.callbacks.onRestart) { this.callbacks.onRestart(); return; }
        if (id === 'SPRINT') { this.sprintActive = !this.sprintActive; return; }
        if (id === 'ACT' && this.callbacks.onPrimaryAction) this.callbacks.onPrimaryAction();
        if (id === 'USE' && this.callbacks.onInteract) this.callbacks.onInteract();
        if (id === 'LIGHT' && this.callbacks.onToggleFlashlight) this.callbacks.onToggleFlashlight();
        if (id === 'BUILD' && this.callbacks.onToggleBuild) this.callbacks.onToggleBuild();
        if (id === 'CRAFT' && this.callbacks.onToggleCraft) this.callbacks.onToggleCraft();
        if (id === 'EQUIP' && this.callbacks.onToggleEquipment) this.callbacks.onToggleEquipment();
        if (id === 'DROP' && this.callbacks.onDrop) this.callbacks.onDrop();
        if (id === 'SPACE' && this.callbacks.onSpace) this.callbacks.onSpace();
        if (id === 'MENU' && this.callbacks.onMenu) this.callbacks.onMenu();
    }

    draw(ctx, width, height, struggleActive = false, isDead = false) {
        if (!this.enabled) return;
        this.buildLayout(width, height, struggleActive, isDead);

        ctx.save();

        if (!this.editMode) {
            if (this.stick.active) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.stick.startX, this.stick.startY, this.stick.maxR, 0, Math.PI * 2);
                ctx.stroke();

                const dx = this.stick.currX - this.stick.startX;
                const dy = this.stick.currY - this.stick.startY;
                const dist = Math.min(Math.hypot(dx, dy), this.stick.maxR);
                const ang = Math.atan2(dy, dx);

                ctx.fillStyle = 'rgba(254, 240, 138, 0.55)';
                ctx.beginPath();
                ctx.arc(this.stick.startX + Math.cos(ang) * dist, this.stick.startY + Math.sin(ang) * dist, 20, 0, Math.PI * 2);
                ctx.fill();
            } else if (!struggleActive && !isDead) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(95, height - 140, 44, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        for (const b of this.buttons) {
            ctx.fillStyle = this.editMode
                ? 'rgba(254, 240, 138, 0.25)'
                : (b.active ? 'rgba(74, 222, 128, 0.35)' : 'rgba(15, 14, 8, 0.65)');
            ctx.strokeStyle = this.editMode ? '#fef08a' : (b.color || 'rgba(255, 255, 255, 0.45)');
            ctx.lineWidth = 2;

            if (b.rect) {
                ctx.fillRect(b.x, b.y, b.w, b.h);
                ctx.strokeRect(b.x, b.y, b.w, b.h);
            } else {
                ctx.beginPath();
                ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = b.color || '#ffffff';
            ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
        }

        if (this.editMode) {
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(width / 2 - 90, 20, 180, 42);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('СОХРАНИТЬ КНОПКИ', width / 2, 41);

            ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
            ctx.fillRect(width / 2 - 90, 70, 180, 36);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText('СБРОС ПО УМОЛЧАНИЮ', width / 2, 88);
        }

        ctx.restore();
    }
}
