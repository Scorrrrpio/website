import { mat4 } from "gl-matrix";

// TODO split into two classes? (ortho and perspective)
export class CameraComponent {
    constructor(aspect=1, offset=[0, 0, 0], ortho=false, maxLook, minLook) {
        this.offset = offset;  // TODO offset as TransformComponent?
        // view matrix
        this.view = mat4.create();
        // projection matrix
        this.aspect = aspect;
        this.fov = Math.PI / 6;
        this.near = 0.01;
        this.far = 1000.0;
        this.projection = mat4.create();
        this.orthographic = ortho;
        this.updateProjectionMatrix();

        // clamp look angle
        this.maxLook = maxLook;
        this.minLook = minLook || maxLook ? -maxLook : maxLook;
    }

    getEye(position=[0, 0, 0]) {
        return [
            position[0] + this.offset[0],
            position[1] + this.offset[1],
            position[2] + this.offset[2],
        ];
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

    updateViewMatrix(transform) {
        const rotation = transform.rotation;
        rotation[0] = Math.max(this.minLook, Math.min(this.maxLook, rotation[0]));
        mat4.rotateX(this.view, mat4.create(), rotation[0]);
        mat4.rotateY(this.view, this.view, rotation[1]);
        mat4.rotateZ(this.view, this.view, rotation[2]);

        const position = transform.position;
        mat4.translate(this.view, this.view, [-position[0]-this.offset[0], -position[1]-this.offset[1], -position[2]-this.offset[2]]);
    }
}