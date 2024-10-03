import { getAnimationClass } from "../../js/templates/animation";
const Animation = getAnimationClass();

// TODO amount
// TODO universal spin

export class SpinY extends Animation {
    static animate(entity, ecs) {
        const transform = ecs.getComponent(entity, "TransformComponent");
        transform.rotate([0, 0.02, 0]);
        transform.createModelMatrix();
    }
}