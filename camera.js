export class Camera {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.tilt = 0;
        this.bobTimer = 0;
        this.bobIntensity = 1.6;
    }

    update(dt, player, input, canvasWidth, canvasHeight) {
        const lookAheadX = (input.mouse.x - canvasWidth / 2) * 0.12;
        const lookAheadY = (input.mouse.y - canvasHeight / 2) * 0.12;

        const targetX = player.x + lookAheadX;
        const targetY = player.y + lookAheadY;

        const smoothness = 6 * dt;
        this.x += (targetX - this.x) * smoothness;
        this.y += (targetY - this.y) * smoothness;

        const { dx, dy } = input.getMovementVector();
        const isMoving = Math.hypot(dx, dy) > 0;
        
        const tiltAmount = player.isSprinting ? 0.055 : 0.03;
        const targetTilt = (dx * tiltAmount) + (Math.cos(player.angle) * 0.01);
        this.tilt += (targetTilt - this.tilt) * (8 * dt);

        if (isMoving) {
            const stepSpeed = player.isSprinting ? 16 : 8;
            this.bobTimer += dt * stepSpeed;
            this.bobIntensity = player.isSprinting ? 4.2 : 1.6;
        } else {
            this.bobTimer = 0;
        }
    }

    apply(ctx, canvasWidth, canvasHeight, motionEnabled = true) {
        if (!motionEnabled) {
            ctx.translate(canvasWidth / 2 - this.x, canvasHeight / 2 - this.y);
            return;
        }

        const bobOffsetY = Math.sin(this.bobTimer) * this.bobIntensity;
        const bobTilt = Math.cos(this.bobTimer * 0.5) * (this.bobIntensity * 0.002);

        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.rotate(this.tilt + bobTilt);
        ctx.translate(-this.x, -this.y + bobOffsetY);
    }
}
