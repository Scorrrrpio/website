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

function raycast(boxes, rayOrigin, rotation, inputs) {
    const forwardX = Math.cos(rotation[0]) * Math.sin(rotation[1]);
    const forwardY = Math.sin(rotation[0]);
    const forwardZ = Math.cos(rotation[0]) * Math.cos(rotation[1]);

    const rayDirection = normalize([forwardX, -forwardY, -forwardZ]);

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

export function movePlayer(boxes, inputs, position, rotation, camera, physics) {
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

    movement = normalizeXZ(movement, physics.maxSpeed);

    // jumping
    if (inputs.space) {
        if (physics.grounded) {
            physics.jumpSpeed = physics.jumpImpulse;
            physics.grounded = false;
        }
    }
    movement[1] += physics.jumpSpeed;
    if (!physics.grounded) { physics.jumpSpeed -= physics.gravity; }
    physics.grounded = false;

    // absolute floor
    position[1] = Math.max(0, position[1]);  // floor
    if (position[1] === 0) {
        physics.jumpSpeed = 0;
        physics.grounded = true;
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
    const nextAABB = AABBComponent.createPlayerAABB(nextPos);

    for (const box of boxes) {
        if (nextAABB.checkCollision(box)) {
            // modify movement
            movement = slide(nextAABB, box, movement, position, camera, physics);
        }
    }

    // move camera
    position[0] += movement[0];
    position[1] += movement[1];
    position[2] += movement[2];

    // update camera view matrix
    camera.updateViewMatrix(position, rotation);

    // cast interaction ray
    if (inputs.leftMouse) {
        raycast(boxes, [position[0] + camera.offset[0], position[1] + camera.offset[1], position[2] + camera.offset[2]], rotation, inputs);  // TODO not snappy
    }
}

function slide(box1, box2, movement, position, camera, physics) {
    // faces names are for player but based on world axes
    // y
    if (box1.max[1] >= box2.max[1]) {  // bottom
        if (position[1] > box2.max[1]) {  // from above
            movement[1] = Math.max(0, movement[1]);
            physics.grounded = true;
            physics.jumpSpeed = 0;
        }
    }
    else if (box1.min[1] < box2.min[1]) {  // top
        if (position[1] + camera.offset[1] < box2.min[1]) {  // TODO I don't like this
            movement[1] = Math.min(0, movement[1]);
            physics.jumpSpeed = 0;
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