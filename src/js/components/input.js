export class InputComponent {
    constructor() {
        this.keyboard = {};  // holds currently pressed keys
        this.mouse = {};  // holds currently pressed mouse buttons

        this.mouseDelta = [0, 0];
        this.scroll = 0;

        this.xSense = 0.002;
        this.ySense = 0.002;
        this.scrollSense = 1;
    }

    enableControls() {
        // keyboard input
        this.keypressHandler = this.#key.bind(this);
        document.addEventListener("keydown", this.keypressHandler);
        document.addEventListener("keyup", this.keypressHandler);

        // mouse input
        this.mouseHandler = this.#mouse.bind(this);
        document.addEventListener("mousemove", this.mouseHandler);
        document.addEventListener("mousedown", this.mouseHandler);
        document.addEventListener("mouseup", this.mouseHandler);

        // scrolling
        this.scrollHandler = this.#scroll.bind(this);
        document.addEventListener("wheel", this.scrollHandler);
    }

    disableControls() {
        // keyboard
        document.removeEventListener("keydown", this.keypressHandler);
        document.removeEventListener("keyup", this.keypressHandler);

        // mouse
        document.removeEventListener("mousemove", this.mouseHandler);
        document.removeEventListener("mousedown", this.mouseHandler);
        document.removeEventListener("mouseup", this.mouseHandler);

        // scrolling
        document.removeEventListener("wheel", this.scrollHandler)

        this.clearAll();  // clear inputs
    }

    // KEYBOARD INPUT
    #key(event) {
        switch(event.type) {
            case "keydown": this.keyboard[event.code] = true; break;
            case "keyup": delete this.keyboard[event.code]; break;
        }
    }

    // MOUSE INPUT
    #scroll(event) { this.scroll += event.deltaY * this.scrollSense; }
    #mouse(event) {
        switch (event.type) {
            case "mousedown": this.mouse[event.button] = true; break;
            case "mouseup": delete this.mouse[event.button]; break;
            case "mousemove":
                this.mouseDelta[1] += event.movementX * this.xSense;
                this.mouseDelta[0] += event.movementY * this.ySense;
                // TODO browser issue
                // random spikes for movementX/movementY when usng mouse
                // see https://unadjusted-movement.glitch.me/ for visualization
                /*
                if (deltaX > 100 || deltaX < -100) {
                    console.log("DELTA X:", deltaX);
                    console.log("DELTA Y:", deltaY);
                    console.log("ROTATION:", this.rotation);
                    this.rotation[1] += this.xSense * deltaX;  // yaw
                    this.rotation[0] += this.ySense * deltaY;  // pitch
                    console.log("ROTATION AFTER:", this.rotation);
                    debugger;
                }
                */
                break;
        }
    }

    // CLEAR ALL INPUT
    clearAll() {
        Object.keys(this.keyboard).forEach((key) => delete this.keyboard[key]);
        Object.keys(this.mouse).forEach((button) => delete this.mouse[button]);
    }

    // READ AND RESET
    readScroll() {
        const frameScroll = this.scroll;
        this.scroll = 0;
        return frameScroll;
    }

    readMouseDelta() {
        const frameMouse = this.mouseDelta;
        this.mouseDelta = [0, 0];
        return frameMouse;
    }
}