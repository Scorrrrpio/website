import { vec3 } from "gl-matrix";

class Collider {  // TODO why?
    constructor(verts, href=null, ghost=false, velocity=[0, 0, 0]) {
        this.verts = verts;
        this.href = href;
        this.ghost = ghost;
        this.velocity = velocity;  // TODO why?
    }

    translate(vector) {
        for (const i in verts) {
            verts[i][0] += vector[0];
            verts[i][1] += vector[1];
            verts[i][2] += vector[2];
        }
    }

    copy() {
        throw new Error("Copy behaviour must be implemented by subclasses of Collider");
    }

    setProperties(href=null, ghost=false, velocity=[0, 0, 0]) {
        this.href = href;
        this.ghost = ghost;
        this.velocity = velocity;
    }

    static checkCollision(other) {
        throw new Error("checkCollision must be implemented by subclasses of Collider");
    }
}

export class AABB extends Collider {
    constructor(min, max, href, ghost, velocity, debug=false) {
        super([min, max], href, ghost, velocity);
        this.min = min;
        this.max = max;
    }

    copy() {
        return new AABB(this.min, this.max, this.hred, this.ghost, this.velocity, this.debug);
    }

    // TODO no rotation
    modelTransform(model) {
        this.min = [0, 0, 0];
        this.max = [0, 0, 0];
        vec3.transformMat4(this.min, this.verts[0], model);
        vec3.transformMat4(this.max, this.verts[1], model);
    }

    translate(vector) {
        this.min[0] += vector[0];
        this.min[1] += vector[1];
        this.min[2] += vector[2];
        this.max[0] += vector[0];
        this.max[1] += vector[1];
        this.max[2] += vector[2];
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

    static createMesh(data, properties) {
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
        return aabb;
    }

    checkCollision(other) {
        if (!other) { return false; }  // TODO why does this happen
        if (this.ghost || other.ghost) { return false; }
        if (other instanceof AABB) {
            return (
                this.min[0] <= other.max[0] && this.max[0] >= other.min[0] &&
                this.min[1] <= other.max[1] && this.max[1] >= other.min[1] &&
                this.min[2] <= other.max[2] && this.max[2] >= other.min[2]
            );
        }
    }
}

export class SphereMesh extends Collider {
    constructor(origin, radius, href, ghost, velocity) {
        super([origin], href, ghost, velocity);
        this.origin = origin;
        this.radius = radius;
    }

    translate(vector) {
        this.origin[0] += vector[0];
        this.origin[1] += vector[1];
        this.origin[2] += vector[2];
    }

    static createMesh(data, properties) {
        const origin = [0, 0, 0];
        // compute max radius
        //throw new Error("Cannot create sphere mesh");
    }
}