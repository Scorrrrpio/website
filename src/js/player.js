import { Camera } from "./camera";
import { AABBComponent } from "./components"; 

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
    cameraOffset = [0, 2, 0];

    // aiming
    // TODO change settings
    xSense = 0.002;
    ySense = 0.002;
    maxLook = Math.PI / 2;
    minLook = -this.maxLook;

    // movement
    maxSpeed = 0.2;

    // jumping
    jumpSpeed = 0;
    jumpImpulse = 0.25;
    gravity = 0.01;
    grounded = true;

    constructor(camera, position, rotation) {
        this.pov = camera;
        this.position = position;
        this.rotation = rotation;
        this.aabb = new AABBComponent(...this.#generateAABB(position));
    }
    
    #generateAABB(pos) {
        return [
            [
                pos[0] - this.boxRadius,
                pos[1],
                pos[2] - this.boxRadius,
            ],
            [
                pos[0] + this.boxRadius,
                pos[1] + this.cameraOffset[1],
                pos[2] + this.boxRadius,
            ],
        ];
    }

    #raycast(boxes, position, rotation, inputs) {
        if (!position) position = this.position;
        if (!rotation) rotation = this.rotation;

        const forwardX = Math.cos(rotation[0]) * Math.sin(rotation[1]);
        const forwardY = Math.sin(rotation[0]);
        const forwardZ = Math.cos(rotation[0]) * Math.cos(rotation[1]);

        const rayDirection = normalize([forwardX, -forwardY, -forwardZ]);
        const rayOrigin = [
            position[0] + this.cameraOffset[0],
            position[1] + this.cameraOffset[1],
            position[2] + this.cameraOffset[2],
        ];

        // check intersection
        let closest;
        let closestDist = Infinity;
        // TODO review
        for (const box of boxes) {
            if (box) {
                let intersect = true;

                let tmin = (box.min[0] - rayOrigin[0]) / rayDirection[0];
                let tmax = (box.max[0] - rayOrigin[0]) / rayDirection[0];

                if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

                let tymin, tymax;
                if (rayDirection[1] !== 0) {
                    tymin = (box.min[1] - rayOrigin[1]) / rayDirection[1];
                    tymax = (box.max[1] - rayOrigin[1]) / rayDirection[1];

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
                    tzmin = (box.min[2] - rayOrigin[2]) / rayDirection[2];
                    tzmax = (box.max[2] - rayOrigin[2]) / rayDirection[2];

                    if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];
                } else {
                    tzmin = -Infinity;
                    tzmax = Infinity;
                }

                if ((tmin > tzmax) || (tzmin > tmax)) intersect = false;

                if (tzmin > tmin) tmin = tzmin;
                if (tzmax < tmax) tmax = tzmax;

                if (intersect) {
                    if (tmin < closestDist) {
                        closest = box;
                        closestDist = tmin;
                    }
                }
            }
        }

        if (closest) {
            // if link
            if (closest.href) {
                console.log("bang");
                // stop movement
                inputs.w = false;
                inputs.a = false;
                inputs.s = false;
                inputs.d = false;
                inputs.space = false;
                inputs.leftMouse = false;
                inputs.rightMouse = false;
                // open link
                window.open(closest.href, "__blank");
            }
        }
    }

    move(boxes, inputs, position, rotation) {
        if (!inputs) inputs;
        if (!position) position = this.position;
        if (!rotation) rotation = this.rotation;

        const forwardX = Math.cos(rotation[0]) * Math.sin(rotation[1]);
        const forwardZ = Math.cos(rotation[0]) * Math.cos(rotation[1]);
        const strafeX = Math.cos(rotation[1]);
        const strafeZ = -Math.sin(rotation[1]);

        let movement = [0, 0, 0];

        // horizontal movement
        if (inputs.w) {
            movement[0] += forwardX;
            movement[2] -= forwardZ;
        }
        if (inputs.a) {
            movement[0] -= strafeX;
            movement[2] += strafeZ;
        }
        if (inputs.s) {
            movement[0] -= forwardX;
            movement[2] += forwardZ;
        }
        if (inputs.d) {
            movement[0] += strafeX;
            movement[2] -= strafeZ;
        }

        movement = normalizeXZ(movement, this.maxSpeed);

        // jumping
        if (inputs.space) {
            if (this.grounded) {
                this.jumpSpeed = this.jumpImpulse;
                this.grounded = false;
            }
        }
        movement[1] += this.jumpSpeed;
        if (!this.grounded) { this.jumpSpeed -= this.gravity; }
        this.grounded = false;

        // absolute floor
        position[1] = Math.max(0, position[1]);  // floor
        if (position[1] === 0) {
            this.jumpSpeed = 0;
            this.grounded = true;
            movement[1] = Math.max(0, movement[1]);
        }
        
        // collision handling
        // predicted position
        const nextPos = [
            position[0] + movement[0],
            position[1] + movement[1],
            position[2] + movement[2],
        ];

        // projected AABB after move
        const nextAABB = new AABBComponent(...this.#generateAABB(nextPos));

        for (const box of boxes) {
            if (nextAABB.checkCollision(box)) {
                // modify movement
                movement = this.#slide(nextAABB, box, movement);
            }
        }

        // move camera
        position[0] += movement[0];
        position[1] += movement[1];
        position[2] += movement[2];
        //this.aabb.translate(movement);

        // update camera view matrix
        this.pov.updateViewMatrix(position, rotation);

        // cast interaction ray
        if (inputs.leftMouse) {
            this.#raycast(boxes, position, rotation, inputs);  // TODO not snappy
        }
    }

    #slide(box1, box2, movement, position) {
        if (!position) position = this.position;
        // faces names are for player but based on world axes
        // y
        if (box1.max[1] >= box2.max[1]) {  // bottom
            if (position[1] > box2.max[1]) {  // from above
                movement[1] = Math.max(0, movement[1]);
                this.grounded = true;
                this.jumpSpeed = 0;
            }
        }
        else if (box1.min[1] < box2.min[1]) {  // top
            if (position[1] + this.cameraOffset[1] < box2.min[1]) {
                movement[1] = Math.min(0, movement[1]);
                this.jumpSpeed = 0;
            }
        }
        // x
        if (box1.max[0] >= box2.max[0]) {  // left
            //movement[0] = Math.max(box2.velocity[0], movement[0]);
            movement[0] = Math.max(box2.velocity[0], movement[0]);
        }
        else if (box1.min[0] <= box2.min[0]) {  // right
            //movement[0] = Math.min(box2.velocity[0], movement[0]);
            movement[0] = Math.min(box2.velocity[0], movement[0]);
        }
        // z
        if (box1.max[2] >= box2.max[2]) {  // front
            //movement[2] = Math.max(box2.velocity[2], movement[2]);
            movement[2] = Math.max(box2.velocity[2], movement[2]);
        }
        else if (box1.min[2] <= box2.min[2]) {  // back
            //movement[2] = Math.min(box2.velocity[2], movement[2]);
            movement[2] = Math.min(box2.velocity[2], movement[2]);
        }

        return movement;
    }
}