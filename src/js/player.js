import { Camera } from "./camera";

export class Player {
    // coordinates
    position = [0, 0, 0];
    rotation = [0, 0, 0];

    // collision
    boxRadius = 0.1;
    aabb;

    pov;  // Camera
    cameraOffset = [0, 1, 0];

    // aiming
    xSense = 0.01;
    ySense = 0.01;
    maxLook = Math.PI / 2;
    minLook = -this.maxLook;

    // movement
    maxSpeed = 0.2;
    // TODO momentum?

    // jumping
    jumpSpeed = 0;
    jumpImpulse = 0.25;
    gravity = 0.01;
    grounded = true;

    // input handling
    inputs = {
        w: false,
        a: false,
        s: false,
        d: false,
        space: false,
    }

    constructor(canvas, position, rotation) {
        this.pov = new Camera(canvas.width / canvas.height);  // default fov, near plane, far plane
        this.position = position;
        this.rotation = rotation;
        this.#generateAABB(position);
        this.#enableControls(canvas);
    }

    #generateAABB(pos) {
        this.aabb = {
            min: [
                pos[0] - this.boxRadius,
                pos[1] - 0.1,
                pos[2] - this.boxRadius,
            ],
            max: [
                pos[0] + this.boxRadius,
                pos[1] + 1,
                pos[2] + this.boxRadius,
            ],
        };
    }

    #checkCollision(box2) {
        return (
            this.aabb.min[0] < box2.max[0] &&
            this.aabb.max[0] > box2.min[0] &&
            this.aabb.min[1] < box2.max[1] &&
            this.aabb.max[1] > box2.min[1] &&
            this.aabb.min[2] < box2.max[2] &&
            this.aabb.max[2] > box2.min[2]
        );
    }

    #enableControls(canvas) {
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
                    case "escape":
                        // release pointer lock on canvas
                        document.exitPointerLock();
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

        // mouse movement
        document.addEventListener("mousemove", (event) => {
            if (document.pointerLockElement === canvas) {
                const deltaX = event.movementX;
                const deltaY = event.movementY;

                this.rotation[1] += this.xSense * deltaX;  // yaw
                this.rotation[0] += this.ySense * deltaY;  // pitch

                // prevent flipping
                this.rotation[0] = Math.max(this.minLook, Math.min(this.maxLook, this.rotation[0]));
            }
        });

        // request pointer lock within canvas
        canvas.addEventListener("click", (event) => {
            if (document.pointerLockElement === canvas) {
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
                canvas.requestPointerLock();
            }
        });
    }

    move(box2) {
        const forwardX = Math.cos(this.rotation[0]) * Math.sin(this.rotation[1]);
        const forwardZ = Math.cos(this.rotation[0]) * Math.cos(this.rotation[1]);
        const strafeX = Math.cos(this.rotation[1]);
        const strafeZ = -Math.sin(this.rotation[1]);

        let movement = [0, 0, 0];

        // horizontal movement
        // TODO normalize
        if (this.inputs.w) {
            movement[0] += this.maxSpeed * forwardX;
            movement[2] -= this.maxSpeed * forwardZ;
        }
        if (this.inputs.a) {
            movement[0] -= this.maxSpeed * strafeX;
            movement[2] += this.maxSpeed * strafeZ;
        }
        if (this.inputs.s) {
            movement[0] -= this.maxSpeed * forwardX;
            movement[2] += this.maxSpeed * forwardZ;
        }
        if (this.inputs.d) {
            movement[0] += this.maxSpeed * strafeX;
            movement[2] -= this.maxSpeed * strafeZ;
        }

        // jumping
        if (this.inputs.space) {
            if (this.grounded) {
                console.log("jump");
                this.jumpSpeed = this.jumpImpulse;
                this.grounded = false;
            }
        }
        movement[1] += this.jumpSpeed;
        this.jumpSpeed -= this.gravity;

        // predicted position
        const nextPos = [
            this.position[0] + movement[0],
            this.position[1] + movement[1],
            this.position[2] + movement[2],
        ];

        // update AABB
        this.#generateAABB(nextPos);

        // TODO box2 is a placeholder
        if (this.#checkCollision(box2)) {
            const axis = this.#collisionAxis(box2);

            movement[0] *= axis[0];
            movement[1] *= axis[1];
            movement[2] *= axis[2];
        }

        this.position[0] += movement[0];
        this.position[1] += movement[1];
        this.position[2] += movement[2];

        // absolute floor
        this.position[1] = Math.max(0, this.position[1]);  // floor
        if (this.position[1] === 0) {
            this.jumpSpeed = 0;
            this.grounded = true;
        }

        // update camera view matrix
        this.pov.updateViewMatrix([
            this.position[0] + this.cameraOffset[0],
            this.position[1] + this.cameraOffset[1],
            this.position[2] + this.cameraOffset[2],
        ], this.rotation);
    }

    #collisionAxis(box) {
        const normal = [1, 1, 1];

        // x
        if (this.aabb.max[0] <= box.min[0]) {
            console.log("left");
            normal[0] = 0;   // left face
        }
        if (this.aabb.min[0] >= box.max[0]) {
            console.log("right");
            normal[0] = 0;   // right face
        }
        // y
        console.log(this.aabb, box);
        if (this.aabb.max[1] >= box.max[1]) {
            //console.log("top: player: ", this.aabb.min[1], "<= box: ", box.max[1]);
            console.log("BOTTOM")
            //console.log("player: ", this.aabb.min[1], this.aabb.max[1]);
            normal[1] = 0;  // top face
            this.grounded = true;
            this.jumpSpeed = 0;
        }
        else if (this.aabb.min[1] <= box.min[1]) {
            console.log("TOP");
            //console.log("bottom: player: ", this.aabb.max[1], ">= box: ", box.min[1]);
            //console.log("player: ", this.aabb.min[1], this.aabb.max[1]);
            normal[1] = 0;  // bottom face
            this.jumpSpeed = 0;
        }
        // z
        if (this.aabb.max[2] <= box.min[2]) {
            console.log("back");
            normal[2] = 0;  // back face
        }
        if (this.aabb.min[2] >= box.max[2]) {
            console.log("front");
            normal[2] = 0;   // front face
        }

        return normal;
    }
}