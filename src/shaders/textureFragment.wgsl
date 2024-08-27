struct VertexOutput {
    @location(0) rawPos: vec3f,
    @location(1) worldPos: vec3f,
    @location(2) scale: vec3f,
    @location(3) uv: vec2f,
    @builtin(position) position: vec4f
};

@group(0) @binding(3) var texture: texture_2d<f32>;
@group(0) @binding(4) var mySampler: sampler;

fn drawGrid(pos: vec3f, evenScale: vec3f, colour: vec3f, clear: vec4f) -> vec4f {
    var gridPos = (abs(pos) + 0.5 * evenScale) % 1;
    if ((gridPos.x < 0.01 || gridPos.x >= 0.99) && abs(pos.x) % 1 != 0.5 * evenScale.x) {
        return vec4f(colour / 8.0, 1);
    }
    if ((gridPos.z < 0.01 || gridPos.z >= 0.99) && abs(pos.z) % 1 != 0.5 * evenScale.z) {
        return vec4f(colour / 8.0, 1);
    }
    if ((gridPos.y < 0.01 || gridPos.y >= 0.99) && abs(pos.y) % 1 != 0.5 * evenScale.y) {
        return vec4f(colour / 8.0, 1);
    }
    return clear;
}

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    var texCol = textureSample(texture, mySampler, fragData.uv);
    var gridPos = fragData.rawPos;
    var evenScale = vec3f(1, 1, 1);

    if (fragData.rawPos.x == 0.5) {
        // right
        return drawGrid(gridPos, evenScale, abs(fragData.worldPos) + vec3f(0, 0, 8.0), texCol);
    }
    if (fragData.rawPos.x == -0.5) {
        // left
        return drawGrid(gridPos, evenScale, abs(fragData.worldPos) + vec3f(0, 0, 8.0), texCol);
    }
    if (fragData.rawPos.y == 0.5) {
        // top
        return drawGrid(gridPos, evenScale, abs(fragData.worldPos) + vec3f(0, 0, 8.0), texCol);
    }
    if (fragData.rawPos.y == -0.5) {
        // bottom
        return drawGrid(gridPos, evenScale, abs(fragData.worldPos) + vec3f(0, 0, 8.0), texCol);
    }
    if (fragData.rawPos.z == 0.5) {
        // front
        return drawGrid(gridPos, evenScale, abs(fragData.worldPos) + vec3f(0, 0, 8.0), texCol);
    }
    if (fragData.rawPos.z == -0.5) {
        // back
        return drawGrid(gridPos, evenScale, abs(fragData.worldPos) + vec3f(0, 0, 8.0), texCol);
    }

    gridPos *=  fragData.scale;
    evenScale = fragData.scale % 2;

    return drawGrid(gridPos, evenScale, abs(fragData.worldPos) + vec3f(0, 0, 8.0), vec4f(0, 0, 0, 1));
}