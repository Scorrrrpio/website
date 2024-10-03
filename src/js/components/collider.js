import { vec3 } from "gl-matrix";

// COLLIDERS
class ColliderComponent {
    constructor(verts, href=null, ghost=false, velocity=[0, 0, 0]) {
        this.verts = verts;
        this.href = href;
        this.ghost = ghost;
        this.velocity = velocity;  // TODO assimilate into physics.js
    }

    modelTransform() {
        throw new Error("modelTransform must be implemented by subclasses of ColliderComponent");
    }

    static createFromMesh() {
        throw new Error("createMesh must be implemented by subclasses of ColliderComponent");
    }

    checkCollision() {
        throw new Error("checkCollision must be implemented by subclasses of ColliderComponent");
    }
}

export class AABBComponent extends ColliderComponent {
    constructor(min, max, href, ghost, velocity) {
        super([min, max], href, ghost, velocity);
        this.min = min;
        this.max = max;
    }

    modelTransform(model) {
        // ensure no rotation
        if (model[1] !== 0 || model[2] !== 0 || model[4] !== 0 || model[6] !== 0 || model[8] !== 0 || model[9] !== 0) {
            this.ghost = true;
            console.warn("Skipped attempt to transform AABB with rotation. Consider using an OBB instead");
            return;
        }

        this.min = [0, 0, 0];
        this.max = [0, 0, 0];
        vec3.transformMat4(this.min, this.verts[0], model);
        vec3.transformMat4(this.max, this.verts[1], model);
    }
    
    toVertices() {
        const vertices = new Float32Array(72);
        let vIndex = 0;
        // face 1
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        // face 2
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        // connectors
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        return vertices;
    }

    static createFromMesh(data, properties, href, ghost, velocity) {
        const xIndex = properties.indexOf("x");
        const yIndex = properties.indexOf("y");
        const zIndex = properties.indexOf("z");
    
        const aabb = {
            min: [Infinity, Infinity, Infinity],
            max: [-Infinity, -Infinity, -Infinity],
        };
        for (const i in data) {
            if (i % properties.length === xIndex) {
                if (data[i] < aabb.min[0]) { aabb.min[0] = data[i]; }
                if (data[i] > aabb.max[0]) { aabb.max[0] = data[i]; }
            }
            if (i % properties.length === yIndex) {
                if (data[i] < aabb.min[1]) { aabb.min[1] = data[i]; }
                if (data[i] > aabb.max[1]) { aabb.max[1] = data[i]; }
            }
            if (i % properties.length === zIndex) {
                if (data[i] < aabb.min[2]) { aabb.min[2] = data[i]; }
                if (data[i] > aabb.max[2]) { aabb.max[2] = data[i]; }
            }
        }
        return new AABBComponent(aabb.min, aabb.max, href, ghost, velocity);
    }

    static createPlayerAABB(position) {
        return new AABBComponent([
            position[0]-0.4,
            position[1],
            position[2]-0.4,
        ], [
            position[0]+0.4,
            position[1]+2,
            position[2]+0.4,
        ]);
    }

    checkCollision(other) {
        if (this.ghost || other.ghost) { return false; }
        if (other instanceof AABBComponent) {
            return (
                this.min[0] <= other.max[0] && this.max[0] >= other.min[0] &&
                this.min[1] <= other.max[1] && this.max[1] >= other.min[1] &&
                this.min[2] <= other.max[2] && this.max[2] >= other.min[2]
            );
        }
    }
}