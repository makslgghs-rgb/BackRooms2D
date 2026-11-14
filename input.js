export class Input {
    constructor(canvas, callbacks = {}) {
        this.keys = {};
        this.mouse = { x: -100, y: -100 };
        this.touchControls = null;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Tab') {
                e.preventDefault();
                if (!this.keys['Tab'] && callbacks.onToggleEquipment) {
                    callbacks.onToggleEquipment();
                }
            }

            if (!this.keys[e.code]) {
                if (e.code === 'KeyF' && callbacks.onToggleFlashlight) {
                    callbacks.onToggleFlashlight();
                }
                if (e.code === 'KeyB' && callbacks.onToggleBuild) {
                    callbacks.onToggleBuild();
                }
                if (e.code === 'KeyC' && callbacks.onToggleCraft) {
                    callbacks.onToggleCraft();
                }
                if (e.code === 'KeyE' && callbacks.onInteract) {
                    callbacks.onInteract();
                }
                if (e.code === 'KeyQ' && callbacks.onDrop) {
                    callbacks.onDrop();
                }
                if (e.code === 'Space' && callbacks.onSpace) {
                    e.preventDefault();
                    callbacks.onSpace();
                }
                if (e.code === 'KeyR' && callbacks.onRestart) {
                    callbacks.onRestart();
                }
                if (e.code.startsWith('Digit') && callbacks.onDigit) {
                    const num = parseInt(e.code.replace('Digit', ''), 10);
                    if (num >= 1 && num <= 8) callbacks.onDigit(num - 1);
                }
            }
            this.keys[e.code] = true;
        });
        
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        
        canvas.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0 && callbacks.onPrimaryAction) callbacks.onPrimaryAction();
            if (e.button === 2 && callbacks.onSecondaryAction) callbacks.onSecondaryAction();
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    isSprinting() {
        const touchSprint = this.touchControls ? this.touchControls.isSprinting() : false;
        return Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || touchSprint);
    }

    getMovementVector() {
        if (this.touchControls) {
            const tv = this.touchControls.getMovementVector();
            if (Math.hypot(tv.dx, tv.dy) > 0) return tv;
        }

        let dx = 0;
        let dy = 0;

        if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

        const length = Math.hypot(dx, dy);
        if (length > 0) {
            dx /= length;
            dy /= length;
        }

        return { dx, dy };
    }
}
