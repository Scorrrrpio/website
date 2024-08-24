import { mat4 } from "gl-matrix";

export class Camera {
    // view matrix
    view = mat4.create();

    // projection matrix
    fov = Math.PI / 6;
    aspect = 1;
    near = 0.1;
    far = 100.0;
    projection = mat4.create();

    constructor(aspect, fov, near, far) {
        // projection matrix setup
        this.fov = fov;
        this.aspect = aspect;
        this.near = near;
        this.far = far;
        mat4.perspective(this.projection, fov, this.aspect, near, far);
    }

    updateProjectionMatrix(aspect, fov, near, far) {
        mat4.perspective(this.projection, fov, this.aspect, near, far);
    }

    updateViewMatrix(position, rotation) {
        mat4.rotateX(this.view, mat4.create(), rotation[0]);
        mat4.rotateY(this.view, this.view, rotation[1]);
        mat4.rotateZ(this.view, this.view, rotation[2]);
        mat4.translate(this.view, this.view, [-position[0], -position[1], -position[2]]);
        if (this.view.some(isNaN)) {
            throw new RangeError("NaN in view matrix");
        }
    }
}