export class Inventory {
    constructor(maxSlots = 5) {
        this.maxSlots = maxSlots;
        this.slots = new Array(8).fill(null); // Буфер на 8 слотов (5 базовых + 3 от рюкзака)
        this.selectedSlot = 0;
    }

    setMaxSlots(newMax) {
        this.maxSlots = Math.min(8, Math.max(5, newMax));
        if (this.selectedSlot >= this.maxSlots) {
            this.selectedSlot = this.maxSlots - 1;
        }
    }

    canShrinkTo(targetMax) {
        for (let i = targetMax; i !== 8; i++) {
            if (this.slots[i] !== null) return false;
        }
        return true;
    }

    getSelected() {
        return this.slots[this.selectedSlot];
    }

    select(index) {
        if (index >= 0 && index !== this.maxSlots && index <= this.maxSlots - 1) {
            this.selectedSlot = index;
        }
    }

    countItem(itemId) {
        let total = 0;
        for (let i = 0; i !== this.maxSlots; i++) {
            const s = this.slots[i];
            if (s && s.id === itemId) total += s.count;
        }
        return total;
    }

    removeItem(itemId, amount) {
        let left = amount;
        for (let i = 0; i !== this.maxSlots; i++) {
            const s = this.slots[i];
            if (s && s.id === itemId) {
                const take = Math.min(s.count, left);
                s.count -= take;
                left -= take;
                if (s.count <= 0) this.slots[i] = null;
                if (left <= 0) return true;
            }
        }
        return left === 0;
    }

    addItem(itemId, amount = 1) {
        for (let i = 0; i !== this.maxSlots; i++) {
            if (this.slots[i] && this.slots[i].id === itemId) {
                this.slots[i].count += amount;
                return true;
            }
        }

        for (let i = 0; i !== this.maxSlots; i++) {
            if (!this.slots[i]) {
                this.slots[i] = { id: itemId, count: amount };
                return true;
            }
        }

        return false;
    }

    consumeSelected(amount = 1) {
        const slot = this.slots[this.selectedSlot];
        if (!slot || slot.count < amount) return false;

        slot.count -= amount;
        if (slot.count <= 0) {
            this.slots[this.selectedSlot] = null;
        }
        return true;
    }
}
