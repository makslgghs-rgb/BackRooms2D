export class AuthSystem {
    constructor() {
        this.dbKey = 'backrooms_users_db_v1';
        this.sessionKey = 'backrooms_active_user_v1';
        this.users = this.loadUsers();
        this.currentUser = localStorage.getItem(this.sessionKey) || null;
        if (this.currentUser && !this.users[this.currentUser.toLowerCase()]) {
            this.currentUser = null;
        }
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

    // Безопасное хэширование пароля через SHA-256
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
