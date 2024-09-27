import { getAnimationClass } from "../../js/templates/animation";
const Animation = getAnimationClass();

// TODO amount
// TODO universal spin

export class SpinY extends Animation {
    static animate(entity, ecs) {
        const transform = ecs.getComponent(entity, "TransformComponent");
        transform.rotation[1] += 0.02;
        transform.createModelMatrix();
    }
}