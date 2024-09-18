export function spinY(transform) {
    transform.rotation[1] += 0.02;
    transform.createModelMatrix();
}

export function lokiSpin(transform) {
    transform.rotation[0] -= 0.001;
    transform.rotation[1] += 0.005;
    transform.rotation[2] -= 0.0005;
    transform.createModelMatrix();
}

export function move(transform, collider) {
    transform.position[0] += collider.velocity[0];
    transform.position[1] += collider.velocity[1];
    transform.position[2] += collider.velocity[2];
    transform.createModelMatrix();
    collider.modelTransform(transform.model);
}