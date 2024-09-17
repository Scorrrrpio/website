import { mat4 } from "gl-matrix";

export class Entity {
    constructor(id, vb, vertCount, modelBuffer, bg, pl, collider, animation, transforms) {
        // ASSET
        this.vertexBuffer = vb;
        this.vertexCount = vertCount;
        // INSTANCE
        this.id = id;
        this.modelBuffer = modelBuffer;
        this.bindGroup = bg;
        this.pipeline = pl;
        this.collider = collider;
        this.animation = animation;
        this.transforms = transforms;
        this.createModelMatrix();
    }

    createModelMatrix() {
        const model = mat4.create();
        mat4.translate(model, model, this.transforms.position);
        mat4.rotateX(model, model, this.transforms.rotation[0]);
        mat4.rotateY(model, model, this.transforms.rotation[1]);
        mat4.rotateZ(model, model, this.transforms.rotation[2]);
        mat4.scale(model, model, this.transforms.scale);
        this.model = model;
        if (this.collider) this.#transformCollider();
    }

    #transformCollider() {
        this.collider.modelTransform(this.model);
    }
}

export class Mesh {
    constructor(vb, vbAttributes, propertyCount, vertexCount, collider) {
        this.vertexBuffer = vb;
        this.vbAttributes = vbAttributes;
        this.propertyCount = propertyCount;
        this.vertexCount = vertexCount;
        this.collider = collider;
    }
}

export class MeshInstance {
    constructor(id, modelBuffer, bg, pl, collider, animation, transforms) {
        this.id = id;
        this.transforms = transforms;
        this.collider = collider;
        this.modelBuffer = modelBuffer;
        this.createModelMatrix();
        this.bindGroup = bg;
        this.pipeline = pl;
        this.animation = animation;
    }

    debug(vb, vCount, bg, pl) {
        this.debugVertexBuffer = vb;
        this.debugVertexCount = vCount;
        this.debugBindGroup = bg;
        this.debugPipeline = pl;
    }

    createModelMatrix() {
        const model = mat4.create();
        mat4.translate(model, model, this.transforms.position);
        mat4.rotateX(model, model, this.transforms.rotation[0]);
        mat4.rotateY(model, model, this.transforms.rotation[1]);
        mat4.rotateZ(model, model, this.transforms.rotation[2]);
        mat4.scale(model, model, this.transforms.scale);
        this.model = model;
        if (this.collider) this.#transformCollider();
    }

    #transformCollider() {
        this.collider.modelTransform(this.model);
    }
}