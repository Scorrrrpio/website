export function spinY(renderable) {
    renderable.transforms.rotation[1] += 0.02;
    renderable.createModelMatrix();
}

export function lokiSpin(renderable) {
    renderable.transforms.rotation[0] -= 0.001;
    renderable.transforms.rotation[1] += 0.005;
    renderable.transforms.rotation[2] -= 0.0005;
    renderable.createModelMatrix();
}

export function move(renderable) {
    renderable.transforms.position[0] += renderable.collider.velocity[0];
    renderable.transforms.position[1] += renderable.collider.velocity[1];
    renderable.transforms.position[2] += renderable.collider.velocity[2];
    renderable.createModelMatrix();
}