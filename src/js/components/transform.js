import { mat4 } from "gl-matrix";

export class TransformComponent {
    constructor(position=[0, 0, 0], rotation=[0, 0, 0], scale=[1, 1, 1]) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.createModelMatrix();
    }

    rotate(rotation=[0, 0, 0]) {
        this.rotation = [
            this.rotation[0] + rotation[0],
            this.rotation[1] + rotation[1],
            this.rotation[2] + rotation[2]
        ]
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