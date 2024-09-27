import { getAnimationClass } from "../../js/templates/animation";
const Animation = getAnimationClass();

export class Move extends Animation {
    static animate(entity, ecs) {
        const transform = ecs.getComponent(entity, "TransformComponent");
        const collider = ecs.getComponent(entity, "ColliderComponent");
        transform.position[0] += collider.velocity[0];
        transform.position[1] += collider.velocity[1];
        transform.position[2] += collider.velocity[2];
        transform.createModelMatrix();
        collider.modelTransform(transform.model);
    }
}