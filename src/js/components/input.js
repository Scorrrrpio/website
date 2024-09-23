// TODO more versatile (bonus feature)
export class InputComponent {
    constructor() {
        this.inputs = {
            w: false,
            a: false,
            s: false,
            d: false,
            space: false,
            leftMouse: false,
            rightMouse: false,
        }

        // TODO allow changing
        this.xSense = 0.002;
        this.ySense = 0.002;
        this.maxLook = Math.PI / 2;
        this.minLook = -this.maxLook;
        this.scrollSense = 1;

        this.look = [0, 0, 0];
        this.scroll = 0;
    }

    enableControls(canvas) {
        const controlsText = document.getElementById("controls");
        // keyboard input
        document.addEventListener("keydown", (event) => {
            if (document.pointerLockElement === canvas) {
                switch(event.code) {
                    case "KeyW":
                        this.inputs.w = true;
                        break;
                    case "KeyA":
                        this.inputs.a = true;
                        break;
                    case "KeyS":
                        this.inputs.s = true;
                        break;
                    case "KeyD":
                        this.inputs.d = true;
                        break;
                    case "Space":
                        this.inputs.space = true;
                        break;
                }
            }
        });

        document.addEventListener("keyup", (event) => {
            if (document.pointerLockElement === canvas) {
                switch(event.code) {
                    case "KeyW":
                        this.inputs.w = false;
                        break;
                    case "KeyA":
                        this.inputs.a = false;
                        break;
                    case "KeyS":
                        this.inputs.s = false;
                        break;
                    case "KeyD":
                        this.inputs.d = false;
                        break;
                    case "Space":
                        this.inputs.space = false;
                        break;
                }
            }
        });

        // show controls
        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === canvas) {
                // show controls text
                controlsText.style.display = "none";
            }
            else {
                // stop movement
                this.inputs.w = false;
                this.inputs.a = false;
                this.inputs.s = false;
                this.inputs.d = false;
                this.inputs.space = false;
                // show controls text
                controlsText.style.display = "block";
            }
        })

        // mouse movement
        document.addEventListener("mousemove", (event) => {
            if (document.pointerLockElement === canvas) {
                this.look[1] += event.movementX * this.xSense;
                this.look[0] += event.movementY * this.ySense;
                this.look[0] = Math.max(this.minLook, Math.min(this.maxLook, this.look[0]));

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

        document.addEventListener("wheel", (event) => {
            if (document.pointerLockElement === canvas) {
                this.scroll += event.deltaY * this.scrollSense;
            }
        });

        // request pointer lock within canvas
        canvas.addEventListener("click", () => {
            if (document.pointerLockElement !== canvas) {
                // stop movement
                this.inputs.w = false;
                this.inputs.a = false;
                this.inputs.s = false;
                this.inputs.d = false;
                this.inputs.space = false;

                // request pointer lock (and handle browser differences)
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

                if (document.pointerLockElement === canvas) {
                    controlsText.style.display = "none";
                }
            }
        });

        canvas.addEventListener("mousedown", (event) => {
            if (document.pointerLockElement === canvas) {
                // in game
                switch (event.button) {
                    case 0:
                        // left
                        this.inputs.leftMouse = true;
                        break;
                    case 2:
                        this.inputs.rightMouse = true;
                        // right
                        break;
                }
            }
        });

        canvas.addEventListener("mouseup", (event) => {
            if (document.pointerLockElement === canvas) {
                // in game
                switch (event.button) {
                    case 0:
                        // left
                        this.inputs.leftMouse = false;
                        break;
                    case 2:
                        this.inputs.rightMouse = false;
                        // right
                        break;
                }
            }
        });
    }
}