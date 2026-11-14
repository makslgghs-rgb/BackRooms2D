export class GameSettings {
    constructor() {
        this.prefix = 'backrooms_2d_profile_';
        this.activeUser = 'guest';
        this.data = this.getDefaults();
    }

    setUser(username) {
        this.activeUser = (username || 'guest').toLowerCase();
        this.data = this.load();
    }

    getDefaults() {
        return {
            profile: {
                color: '#3b82f6'
            },
            graphics: {
                vhsEffect: true,
                dust: true,
                cameraMotion: true,
                rayCount: 95,
                uiScale: 1.0 // Масштаб интерфейса: 0.75, 1.0, 1.25, 1.5
            },
            friends: []
        };
    }

    load() {
        try {
            const raw = localStorage.getItem(this.prefix + this.activeUser);
            if (!raw) return this.getDefaults();
            const parsed = JSON.parse(raw);
            const def = this.getDefaults();
            return {
                profile: { ...def.profile, ...parsed.profile },
                graphics: { ...def.graphics, ...parsed.graphics },
                friends: Array.isArray(parsed.friends) ? parsed.friends : []
            };
        } catch {
            return this.getDefaults();
        }
    }

    save() {
        localStorage.setItem(this.prefix + this.activeUser, JSON.stringify(this.data));
    }

    addFriend(name, code) {
        if (!name.trim() || !code.trim()) return;
        this.data.friends.push({ name: name.trim(), code: code.trim().toUpperCase() });
        this.save();
    }

    removeFriend(index) {
        this.data.friends.splice(index, 1);
        this.save();
    }
}
