import { mat4 } from "gl-matrix";

export class CameraComponent {
    // view matrix
    view = mat4.create();

    // projection matrix
    fov = Math.PI / 6;
    aspect = 1;
    near = 0.01;
    far = 1000.0;
    projection = mat4.create();

    constructor(aspect, offset=[0, 0, 0], ortho=false) {
        this.offset = offset;
        // projection matrix setup
        this.aspect = aspect;
        this.orthographic = ortho;
        this.updateProjectionMatrix();
    }

    updateProjectionMatrix(aspect = this.aspect, fov = this.fov, near = this.near, far = this.far) {
        this.aspect = aspect;
        this.fov = fov;
        this.near = near;
        this.far = far;
        if (this.orthographic) {
            mat4.ortho(this.projection, -aspect, aspect, -1, 1, -1, 1);
        }
        else {
            mat4.perspective(this.projection, fov, aspect, near, far);
        }
    }

    updateViewMatrix(position, rotation) {
        mat4.rotateX(this.view, mat4.create(), rotation[0]);
        mat4.rotateY(this.view, this.view, rotation[1]);
        mat4.rotateZ(this.view, this.view, rotation[2]);
        mat4.translate(this.view, this.view, [-position[0]-this.offset[0], -position[1]-this.offset[1], -position[2]-this.offset[2]]);
    }
}