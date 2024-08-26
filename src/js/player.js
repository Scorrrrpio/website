import { Camera } from "./camera";

function normalizeXZ(v, speed) {
    const magnitude = Math.sqrt(v[0] * v[0] + v[2] * v[2]);
    if (magnitude > 0) {
        v[0] = v[0] * speed / magnitude ;
        v[2] = v[2] * speed / magnitude;
    }
    return v;
}

function normalize(v) {
    const magnitude = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (magnitude > 0) {
        v[0] = v[0] / magnitude;
        v[1] = v[1] / magnitude;
        v[2] = v[2] / magnitude;
    }
    return v;
}

export class Player {
    // coordinates
    position = [0, 0, 0];
    rotation = [0, 0, 0];

    // collision
    boxRadius = 0.4;

    pov;  // Camera
    cameraOffset = [0, 1, 0];

    // aiming
    // TODO change settings
    xSense = 0.002;
    ySense = 0.002;
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
        return {
            min: [
                pos[0] - this.boxRadius,
                pos[1],
                pos[2] - this.boxRadius,
            ],
            max: [
                pos[0] + this.boxRadius,
                pos[1] + 1,
                pos[2] + this.boxRadius,
            ],
        };
    }

    #checkCollision(box1, box2) {
        return (
            box1.min[0] <= box2.max[0] &&
            box1.max[0] >= box2.min[0] &&
            box1.min[1] <= box2.max[1] &&
            box1.max[1] >= box2.min[1] &&
            box1.min[2] <= box2.max[2] &&
            box1.max[2] >= box2.min[2]
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
                // TODO click and hold / release behaviour
                // in game
                switch (event.button) {
                    case 0:
                        // left
                        this.#raycast();
                        break;
                    case 1:
                        // middle
                        break;
                    case 2:
                        // right
                        break;
                    case 3:
                        // mouse 4
                        break;
                    case 4:
                        // mouse 5
                        break;
                }
            }
            else {
                // free cursor
                canvas.requestPointerLock();
            }
        });
    }

    #raycast() {
        const forwardX = Math.cos(this.rotation[0]) * Math.sin(this.rotation[1]);
        const forwardY = Math.sin(this.rotation[0]);
        const forwardZ = Math.cos(this.rotation[0]) * Math.cos(this.rotation[1]);

        const rayDirection = normalize([forwardX, -forwardY, -forwardZ]);
        const rayOrigin = [
            this.position[0] + this.cameraOffset[0],
            this.position[1] + this.cameraOffset[1],
            this.position[2] + this.cameraOffset[2],
        ];

        // check intersection
        // TODO this is hardcoded
        const demoBox = {
            max: [-3, 5, -3],
            min: [-4, 4, -4],
        };

        // TODO review
        let intersect = true;

        let tmin = (demoBox.min[0] - rayOrigin[0]) / rayDirection[0];
        let tmax = (demoBox.max[0] - rayOrigin[0]) / rayDirection[0];

        if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

        let tymin, tymax;
        if (rayDirection[1] !== 0) {
            tymin = (demoBox.min[1] - rayOrigin[1]) / rayDirection[1];
            tymax = (demoBox.max[1] - rayOrigin[1]) / rayDirection[1];

            if (tymin > tymax) [tymin, tymax] = [tymax, tymin];
        } else {
            tymin = -Infinity;
            tymax = Infinity;
        }

        if ((tmin > tymax) || (tymin > tmax)) intersect = false;

        if (tymin > tmin) tmin = tymin;
        if (tymax < tmax) tmax = tymax;

        let tzmin, tzmax;
        if (rayDirection[2] !== 0) {
            tzmin = (demoBox.min[2] - rayOrigin[2]) / rayDirection[2];
            tzmax = (demoBox.max[2] - rayOrigin[2]) / rayDirection[2];

            if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];
        } else {
            tzmin = -Infinity;
            tzmax = Infinity;
        }

        if ((tmin > tzmax) || (tzmin > tmax)) intersect = false;

        if (tzmin > tmin) tmin = tzmin;
        if (tzmax < tmax) tmax = tzmax;

        if (intersect) {
            console.log("bang");
            window.location.href="https://x.com/amkoz__";z
        }
    }

    move(boxes) {
        const forwardX = Math.cos(this.rotation[0]) * Math.sin(this.rotation[1]);
        const forwardZ = Math.cos(this.rotation[0]) * Math.cos(this.rotation[1]);
        const strafeX = Math.cos(this.rotation[1]);
        const strafeZ = -Math.sin(this.rotation[1]);

        let movement = [0, 0, 0];

        // horizontal movement
        if (this.inputs.w) {
            movement[0] += forwardX;
            movement[2] -= forwardZ;
        }
        if (this.inputs.a) {
            movement[0] -= strafeX;
            movement[2] += strafeZ;
        }
        if (this.inputs.s) {
            movement[0] -= forwardX;
            movement[2] += forwardZ;
        }
        if (this.inputs.d) {
            movement[0] += strafeX;
            movement[2] -= strafeZ;
        }

        movement = normalizeXZ(movement, this.maxSpeed);

        // jumping
        if (this.inputs.space) {
            if (this.grounded) {
                this.jumpSpeed = this.jumpImpulse;
                this.grounded = false;
            }
        }
        movement[1] += this.jumpSpeed;
        this.jumpSpeed -= this.gravity;

        // collision handling
        for (const box of boxes) {
            // predicted position
            const nextPos = [
                this.position[0] + movement[0],
                this.position[1] + movement[1],
                this.position[2] + movement[2],
            ];

            // update AABB
            const aabb = this.#generateAABB(nextPos);

            if (this.#checkCollision(aabb, box)) {
                movement = this.#collisionAxis(aabb, box, movement);
            }
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

    #collisionAxis(box1, box2, movement) {
        // faces names are for player but based on world axes
        // x
        if (box1.max[0] >= box2.max[0]) {  // left
            //this.position[0] = box2.max[0] + this.boxRadius;
            movement[0] = Math.max(0, movement[0]);
        }
        else if (box1.min[0] <= box2.min[0]) {  // right
            //this.position[0] = box2.min[0] - this.boxRadius;
            movement[0] = Math.min(0, movement[0]);
        }
        // y
        if (box1.max[1] >= box2.max[1]) {  // bottom
            if (this.position[1] > box2.max[1]) {
                movement[1] = Math.max(0, movement[1]);
                this.grounded = true;
                this.jumpSpeed = 0;
            }
        }
        else if (box1.min[1] <= box2.min[1]) {  // top
            if (this.position[1] + this.cameraOffset[1] < box2.min[1]) {
                movement[1] = Math.min(0, movement[1]);
                this.jumpSpeed = 0;
            }
        }
        // z
        if (box1.max[2] >= box2.max[2]) {  // front
            //this.position[2] = box2.max[2] + this.boxRadius;
            movement[2] = Math.max(0, movement[2]);
        }
        else if (box1.min[2] <= box2.min[2]) {  // back
            //this.position[2] = box2.min[2] - this.boxRadius;
            movement[2] = Math.min(0, movement[2]);
        }

        return movement;
    }
}