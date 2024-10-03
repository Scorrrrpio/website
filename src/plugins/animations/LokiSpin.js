import { getAnimationClass } from "../../js/templates/animation";
const Animation = getAnimationClass();

export class LokiSpin extends Animation {
    static animate(entity, ecs) {
        const transform = ecs.getComponent(entity, "TransformComponent");
        transform.rotate([-0.001, 0.005, -0.0005]);;
        transform.createModelMatrix();
    }
}