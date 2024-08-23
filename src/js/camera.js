import { mat4 } from "gl-matrix";

export class fpvCamera {
    // canvas
    canvas;

    // coordinates
    position = [0, 0, 0];
    rotation = [0, 0, 0];

    // movement
    maxSpeed = 0.1;
    xSense = 0.01;
    ySense = 0.01;
    maxLook = Math.PI / 2;
    minLook = -this.maxLook;

    // view matrix
    view = mat4.create();

    // projection matrix
    fov = Math.PI / 6;
    aspect = 1;
    near = 0.1;
    far = 100.0;
    projection = mat4.create();

    // input handling
    inputs = {
        w: false,
        a: false,
        s: false,
        d: false,
        space: false,
    }

    constructor(canvas, position, rotation, fov, near, far) {
        // canvas
        this.canvas = canvas;
        // coordinates
        this.position = position;
        this.rotation = rotation;
        // projection matrix
        this.fov = fov;
        this.aspect = canvas.width / canvas.height;
        this.near = near;
        this.far = far;
        mat4.perspective(this.projection, fov, this.aspect, near, far);

        // input handling
        this.#listen();
    }

    #listen() {
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
                    case "space":
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
                    case "space":
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

    #createViewMatrix() {
        mat4.rotateX(this.view, mat4.create(), this.rotation[0]);
        mat4.rotateY(this.view, this.view, this.rotation[1]);
        mat4.rotateZ(this.view, this.view, this.rotation[2]);
        mat4.translate(this.view, this.view, [-this.position[0], -this.position[1], -this.position[2]]);
        if (this.view.some(isNaN)) {
            throw new RangeError("NaN in view matrix");
        }
    }

    updateCamera() {
        const forwardX = Math.cos(this.rotation[0]) * Math.sin(this.rotation[1]);
        const forwardY = Math.sin(this.rotation[0]);
        const forwardZ = Math.cos(this.rotation[0]) * Math.cos(this.rotation[1]);
        const strafeX = Math.cos(this.rotation[1]);
        const strafeZ = -Math.sin(this.rotation[1]);

        // TODO normalize
        if (this.inputs.w) {
            this.position[0] += this.maxSpeed * forwardX;
            this.position[1] -= this.maxSpeed * forwardY;
            this.position[2] -= this.maxSpeed * forwardZ;
        }
        if (this.inputs.a) {
            this.position[0] -= this.maxSpeed * strafeX;
            this.position[2] += this.maxSpeed * strafeZ;
        }
        if (this.inputs.s) {
            this.position[0] -= this.maxSpeed * forwardX;
            this.position[1] += this.maxSpeed * forwardY;
            this.position[2] += this.maxSpeed * forwardZ;
        }
        if (this.inputs.d) {
            this.position[0] += this.maxSpeed * strafeX;
            this.position[2] -= this.maxSpeed * strafeZ;
        }
        if (this.inputs.r) {
            this.position[1] += this.maxSpeed;
        }
        if (this.inputs.f) {
            this.position[1] -= this.maxSpeed;
        }
        this.#createViewMatrix();
    }
}