export class InputComponent {
    constructor() {
        this.keyboard = {};  // holds currently pressed keys
        this.mouse = {};  // holds currently pressed mouse buttons

        this.xSense = 0.002;
        this.ySense = 0.002;
        this.scrollSense = 1;

        this.mouseDelta = [0, 0];
        this.scroll = 0;
    }

    enableControls(canvas) {
        // keyboard input
        document.addEventListener("keydown", (event) => {
            if (document.pointerLockElement === canvas) this.keyboard[event.code] = true;
        });

        document.addEventListener("keyup", (event) => {
            if (document.pointerLockElement === canvas) delete this.keyboard[event.code];
        });

        // TODO as script (unrelated to input handling)
        // show/hide controls text on pointer lock change
        const controlsText = document.getElementById("controls");
        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === canvas) { controlsText.style.display = "none"; }
            else {
                this.clearAll();
                controlsText.style.display = "block";
            }
        })

        // mouse movement
        document.addEventListener("mousemove", (event) => {
            if (document.pointerLockElement === canvas) {
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
            }
        });

        // scrolling
        document.addEventListener("wheel", (event) => {
            if (document.pointerLockElement === canvas) this.scroll += event.deltaY * this.scrollSense;
        });

        // request pointer lock within canvas
        canvas.addEventListener("click", () => {
            if (document.pointerLockElement !== canvas) {
                // chromium returns Promise, firefox returns undefined
                const lockPromise = canvas.requestPointerLock({ unadjustedMovement: true });
                if (lockPromise) {
                    lockPromise.catch((error) => {
                        if (error.name === "NotSupportedError") {
                            canvas.requestPointerLock();
                        }
                        else throw error;
                    })
                }
                // hide control text
                if (document.pointerLockElement === canvas) controlsText.style.display = "none";  // TODO move to script
            }
        });

        canvas.addEventListener("mousedown", (event) => {
            if (document.pointerLockElement === canvas) this.mouse[event.button] = true;
        });

        canvas.addEventListener("mouseup", (event) => {
            if (document.pointerLockElement === canvas) delete this.mouse[event.button];
        });
    }

    clearAll() {
        Object.keys(this.keyboard).forEach((key) => delete this.keyboard[key]);
        Object.keys(this.mouse).forEach((button) => delete this.mouse[button]);
    }

    setSense(xSense, ySense) {
        this.xSense = xSense;
        this.ySense = ySense;
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