export class Move extends Animation {
    static requiredComponents = ["TransformComponent", "ColliderComponent"];  // TODO limited to AABB

    static animate(transform, collider) {
        transform.position[0] += collider.velocity[0];
        transform.position[1] += collider.velocity[1];
        transform.position[2] += collider.velocity[2];
        transform.createModelMatrix();
        collider.modelTransform(transform.model);
    }
}