// TODO amount
export function spinX(transformComponent) {
    transformComponent.rotation[0] += 0.02;
    transformComponent.createModelMatrix();
}

export function spinY(transformComponent) {
    transformComponent.rotation[1] += 0.02;
    transformComponent.createModelMatrix();
}

export function spinZ(transformComponent) {
    transformComponent.rotation[2] += 0.02;
    transformComponent.createModelMatrix();
}

export function lokiSpin(transformComponent) {
    transformComponent.rotation[0] -= 0.001;
    transformComponent.rotation[1] += 0.005;
    transformComponent.rotation[2] -= 0.0005;
    transformComponent.createModelMatrix();
}

// TODO universal spin