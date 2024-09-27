import { getAnimationClass } from "../../js/templates/animation";
const Animation = getAnimationClass();

export class LokiSpin extends Animation {
    static animate(entity, ecs) {
        const transform = ecs.getComponent(entity, "TransformComponent");
        transform.rotation[0] -= 0.001;
        transform.rotation[1] += 0.005;
        transform.rotation[2] -= 0.0005;
        transform.createModelMatrix();
    }
}