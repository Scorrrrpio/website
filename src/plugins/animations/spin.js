class Spin extends Animation {
    static requiredComponents = ["TransformComponent"];
}

// TODO amount
export class SpinX extends Animation {
    static requiredComponents = ["TransformComponent"];

    static animate(transformComponent) {
        transformComponent.rotation[0] += 0.02;
        transformComponent.createModelMatrix();
    }
}

export class SpinY extends Animation {
    static requiredComponents = ["TransformComponent"];

    static animate(transformComponent) {
        transformComponent.rotation[1] += 0.02;
        transformComponent.createModelMatrix();
    }
}

export class SpinZ extends Animation {
    static requiredComponents = ["TransformComponent"];

    static animate(transformComponent) {
        transformComponent.rotation[2] += 0.02;
        transformComponent.createModelMatrix();
    }
}

export class LokiSpin extends Animation {
    static requiredComponents = ["TransformComponent"];

    static animate(transformComponent) {
        transformComponent.rotation[0] -= 0.001;
        transformComponent.rotation[1] += 0.005;
        transformComponent.rotation[2] -= 0.0005;
        transformComponent.createModelMatrix();
    }
}

// TODO universal spin