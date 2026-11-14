export class TouchControls {
    constructor(canvas, input, callbacks = {}) {
        this.canvas = canvas;
        this.input = input;
        this.callbacks = callbacks;

        // Автоматическое определение сенсорного устройства
        this.enabled = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        this.stick = { active: false, id: null, startX: 0, startY: 0, currX: 0, currY: 0, maxR: 52 };
        this.aimTouch = { active: false, id: null };
        this.sprintActive = false;
        this.buttons = [];

        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('touchstart', (e) => {
            // Если пользователь коснулся экрана — гарантированно включаем мобильное управление
            this.enabled = true;
            if (e.target !== this.canvas) return;
            e.preventDefault();

            for (const t of e.changedTouches) {
                const x = t.clientX;
                const y = t.clientY;

                // 1. Проверяем попадание по виртуальным кнопкам
                const btn = this.findButtonAt(x, y);
                if (btn) {
                    this.triggerButton(btn.id);
                    continue;
                }

                // 2. Левая половина экрана — виртуальный стик движения
                if (x < window.innerWidth * 0.45 && !this.stick.active) {
                    this.stick.active = true;
                    this.stick.id = t.identifier;
                    this.stick.startX = x;
                    this.stick.startY = y;
                    this.stick.currX = x;
                    this.stick.currY = y;
                    continue;
                }

                // 3. Правая половина экрана — прицеливание и поворот взгляда
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
        if (!this.enabled || !this.stick.active) return { dx: 0, dy: 0 };
        const rawDx = this.stick.currX - this.stick.startX;
        const rawDy = this.stick.currY - this.stick.startY;
        const dist = Math.hypot(rawDx, rawDy);
        if (dist < 8) return { dx: 0, dy: 0 };

        const clamped = Math.min(dist, this.stick.maxR) / this.stick.maxR;
        return {
            dx: (rawDx / dist) * clamped,
            dy: (rawDy / dist) * clamped
        };
    }

    isSprinting() {
        return this.enabled && this.sprintActive;
    }

    buildLayout(width, height, struggleActive) {
        if (struggleActive) {
            this.buttons = [
                { id: 'SPACE', label: 'ВЫРВАТЬСЯ!', x: width / 2 - 95, y: height - 135, w: 190, h: 64, color: '#ef4444' }
            ];
            return;
        }

        const r = 25;
        const rightX = width - 48;
        const baseY = height - 135;

        this.buttons = [
            { id: 'MENU',  label: 'МЕНЮ', x: width - 85, y: 72, w: 66, h: 30, rect: true },
            { id: 'ACT',   label: 'ИСП',  x: rightX - r, y: baseY - r, w: r * 2, h: r * 2, color: '#4ade80' },
            { id: 'USE',   label: 'E',    x: rightX - 68 - r, y: baseY - r, w: r * 2, h: r * 2, color: '#fef08a' },
            { id: 'SPRINT',label: 'БЕГ',  x: rightX - r, y: baseY - 68 - r, w: r * 2, h: r * 2, active: this.sprintActive },
            { id: 'LIGHT', label: 'СВЕТ', x: rightX - 68 - r, y: baseY - 68 - r, w: r * 2, h: r * 2 },
            { id: 'BUILD', label: 'СТР',  x: rightX - 136 - r, y: baseY - r, w: r * 2, h: r * 2 },
            { id: 'CRAFT', label: 'КРАФТ',x: rightX - 136 - r, y: baseY - 68 - r, w: r * 2, h: r * 2 },
            { id: 'EQUIP', label: 'ШМОТ', x: rightX - 204 - r, y: baseY - 68 - r, w: r * 2, h: r * 2 },
            { id: 'DROP',  label: 'ВЫБР', x: rightX - 204 - r, y: baseY - r, w: r * 2, h: r * 2 }
        ];
    }

    findButtonAt(x, y) {
        for (const b of this.buttons) {
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
        }
        return null;
    }

    triggerButton(id) {
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

    draw(ctx, width, height, struggleActive = false) {
        if (!this.enabled) return;
        this.buildLayout(width, height, struggleActive);

        ctx.save();

        // 1. Отрисовка левого джойстика движения
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
        } else if (!struggleActive) {
            // Подсказка зоны стика слева снизу
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(95, height - 140, 44, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 2. Отрисовка кнопок действий справа
        for (const b of this.buttons) {
            ctx.fillStyle = b.active ? 'rgba(74, 222, 128, 0.35)' : 'rgba(15, 14, 8, 0.65)';
            ctx.strokeStyle = b.color || 'rgba(255, 255, 255, 0.45)';
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

        ctx.restore();
    }
}
