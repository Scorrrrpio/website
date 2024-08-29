import { mat4 } from "gl-matrix";

function createRotationMatrix(angleX, angleY, angleZ) {
    const rotationMatrix = mat4.create();
    mat4.rotateX(rotationMatrix, rotationMatrix, angleX);
    mat4.rotateY(rotationMatrix, rotationMatrix, angleY);
    mat4.rotateZ(rotationMatrix, rotationMatrix, angleZ);
    return rotationMatrix;
}

const spinYMatrix = createRotationMatrix(0, 0.02, 0)
export function spinY(renderable) {
    mat4.multiply(renderable.model, renderable.model, spinYMatrix);
}

const lokiSpinMatrix = createRotationMatrix(-0.001, 0.005, -0.0005);
export function lokiSpin(renderable) {
    mat4.multiply(renderable.model, renderable.model, lokiSpinMatrix);
}