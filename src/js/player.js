import { Camera } from "./camera";

export class Player {
    // canvas
    canvas;

    // coordinates
    position = [0, 0, 0];
    rotation = [0, 0, 0];

    pov;  // Camera
    cameraOffset = [0, 1, 0]

    // aiming
    xSense = 0.01;
    ySense = 0.01;
    maxLook = Math.PI / 2;
    minLook = -this.maxLook;

    // movement
    maxSpeed = 0.2;
    jumpVelocity = 0;
    jumpImpulse = 0.5;
    gravity = 0.03;

    // input handling
    inputs = {
        w: false,
        a: false,
        s: false,
        d: false,
        space: false,
    }

    constructor(canvas, position, rotation) {
        this.canvas = canvas;
        this.pov = new Camera(canvas.width / canvas.height);  // default fov, near plane, far plane
        this.position = position;
        this.rotation = rotation;
        this.#enableControls();
    }

    #enableControls() {
        // keyboard input
        document.addEventListener("keydown", (event) => {
            if (document.pointerLockElement === this.canvas) {
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
                    case "escape":
                        // release pointer lock on canvas
                        document.exitPointerLock();
                }
            }
        });
        document.addEventListener("keyup", (event) => {
            if (document.pointerLockElement === this.canvas) {
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

        // mouse movement
        document.addEventListener("mousemove", (event) => {
            if (document.pointerLockElement === this.canvas) {
                const deltaX = event.movementX;
                const deltaY = event.movementY;

                this.rotation[1] += this.xSense * deltaX;  // yaw
                this.rotation[0] += this.ySense * deltaY;  // pitch

                // prevent flipping
                this.rotation[0] = Math.max(this.minLook, Math.min(this.maxLook, this.rotation[0]));
            }
        });

        // request pointer lock within canvas
        this.canvas.addEventListener("click", (event) => {
            if (document.pointerLockElement === this.canvas) {
                // TODO possibly move elsewhere?
                // in game
                switch (event.button) {
                    case 0:
                        console.log("left");
                        break;
                    case 1:
                        console.log("middle");
                        break;
                    case 2:
                        console.log("right");
                        break;
                    case 3:
                        console.log("4");
                        break;
                    case 4:
                        console.log("5");
                        break;
                    default:
                        console.log("bro what");
                        break;
                }
            }
            else {
                // free cursor
                this.canvas.requestPointerLock();
            }
        });
    }

    move() {
        const forwardX = Math.cos(this.rotation[0]) * Math.sin(this.rotation[1]);
        const forwardZ = Math.cos(this.rotation[0]) * Math.cos(this.rotation[1]);
        const strafeX = Math.cos(this.rotation[1]);
        const strafeZ = -Math.sin(this.rotation[1]);

        // horizontal movement
        // TODO normalize
        if (this.inputs.w) {
            this.position[0] += this.maxSpeed * forwardX;
            this.position[2] -= this.maxSpeed * forwardZ;
        }
        if (this.inputs.a) {
            this.position[0] -= this.maxSpeed * strafeX;
            this.position[2] += this.maxSpeed * strafeZ;
        }
        if (this.inputs.s) {
            this.position[0] -= this.maxSpeed * forwardX;
            this.position[2] += this.maxSpeed * forwardZ;
        }
        if (this.inputs.d) {
            this.position[0] += this.maxSpeed * strafeX;
            this.position[2] -= this.maxSpeed * strafeZ;
        }

        // jumping
        if (this.inputs.space) {
            if (this.position[1] === 0) {  // arbitrary floor TODO physics
                this.jumpVelocity = this.jumpImpulse;
            }
        }
        this.position[1] += this.jumpVelocity;
        this.position[1] = Math.max(0, this.position[1]);  // floor
        this.jumpVelocity -= this.gravity;
        if (this.position[1] === 0) {
            this.jumpVelocity = 0;
        }

        // update camera view matrix
        this.pov.updateViewMatrix([
            this.position[0] + this.cameraOffset[0],
            this.position[1] + this.cameraOffset[1],
            this.position[2] + this.cameraOffset[2],
        ], this.rotation);
    }
}