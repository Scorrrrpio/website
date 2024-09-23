import { mat4 } from "gl-matrix";

export class TransformComponent {
    constructor(position=[0, 0, 0], rotation=[0, 0, 0], scale=[1, 1, 1], animation) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.createModelMatrix();
        this.animation = animation;  // TODO bad solution
    }

    createModelMatrix() {
        const model = mat4.create();
        mat4.translate(model, model, this.position);
        mat4.rotateX(model, model, this.rotation[0]);
        mat4.rotateY(model, model, this.rotation[1]);
        mat4.rotateZ(model, model, this.rotation[2]);
        mat4.scale(model, model, this.scale);
        this.model = model;
    }
}