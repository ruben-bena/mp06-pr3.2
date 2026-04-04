class InputManager {
    constructor(onChangeCallback) {
        this.movementState = { up: false, down: false, left: false, right: false };
        this.onChange = onChangeCallback;
        this.activeTimer = null;
        this.activeKey = null;
        
        this.initialDelay = 550; 
        this.burstDelay = 100;   

        this.sequences = {
            '\u001b[A': 'up',
            '\u001b[B': 'down',
            '\u001b[D': 'left',
            '\u001b[C': 'right'
        };

        this.initRawMode();
    }

    initRawMode() {
        const { stdin } = process;
        if (stdin.isTTY) stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        stdin.on('data', (key) => {
            if (key === '\u0003') process.exit();
            const dir = this.sequences[key];
            if (dir) this.handleInput(dir);
        });
    }

    handleInput(dir) {
        const isNewPress = (this.activeKey !== dir);

        if (isNewPress) {
            // APAGAMOS la anterior y ENCENDEMOS la nueva en memoria antes de avisar
            if (this.activeKey) {
                this.movementState[this.activeKey] = false;
            }
            this.activeKey = dir;
            this.movementState[dir] = true;

            // Emitimos el cambio ATÓMICO (una sola vez con el cambio hecho)
            if (this.onChange) {
                this.onChange({ ...this.movementState });
            }
        }

        // Gestión de timers para detectar cuándo se suelta
        if (this.activeTimer) clearTimeout(this.activeTimer);

        const currentTimeout = isNewPress ? this.initialDelay : this.burstDelay;

        this.activeTimer = setTimeout(() => {
            this.stopAll();
        }, currentTimeout);
    }

    // Solo se llama cuando realmente dejamos de recibir señales (soltamos tecla)
    stopAll() {
        if (this.activeKey) {
            this.movementState[this.activeKey] = false;
            this.activeKey = null;
            if (this.onChange) {
                this.onChange({ ...this.movementState });
            }
        }
        if (this.activeTimer) clearTimeout(this.activeTimer);
        this.activeTimer = null;
    }

    // Convierte movementState en un string que podemos mandar por mensaje al servidor
    parseToDirection() {
        if (this.movementState.up) { return "UP"; }
        if (this.movementState.down) { return "DOWN"; }
        if (this.movementState.left) { return "LEFT"; }
        if (this.movementState.right) { return "RIGHT"; }
        return "NONE";
    }
}

module.exports = InputManager;