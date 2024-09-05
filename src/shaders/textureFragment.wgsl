struct VertexOutput {
    @location(0) rawPos: vec3<f32>,
    @location(1) worldPos: vec3<f32>,
    @location(2) scale: vec3<f32>,
    @location(3) uv: vec2<f32>,
    @builtin(position) position: vec4<f32>
};

@group(0) @binding(3) var texture: texture_2d<f32>;
@group(0) @binding(4) var mySampler: sampler;
@group(0) @binding(5) var<uniform> faceIDs: array<vec4<u32>, 6>;  // [front, back, left, right, top, bottom]

const eps = 0.01;

fn drawGrid(pos: vec3<f32>, gridScale: vec3<f32>, colour: vec3<f32>, clear: vec4<f32>, axis: u32) -> vec4<f32> {
    var gridPos = fract(abs(pos) + 0.5 * gridScale);
    var col = vec4<f32>(colour.r / 32.0, colour.g / 8.0, 1.0 - colour.r / 32.0 - colour.g / 32.0, 1.0);
    if (axis != 0 && (gridPos.x < eps || gridPos.x > 1 - eps) && fract(abs(pos.x)) != 0.5 * gridScale.x) {
        return col;
    }
    if (axis != 2 && (gridPos.z < eps || gridPos.z > 1 - eps) && fract(abs(pos.z)) != 0.5 * gridScale.z) {
        return col;
    }
    if (axis != 1 && (gridPos.y < eps || gridPos.y > 1 - eps) && fract(abs(pos.y)) != 0.5 * gridScale.y) {
        return col;
    }
    return clear;
}

fn isNear(realV: f32, targetV: f32, threshold: f32) -> bool {
    return abs(realV - targetV) < threshold;
}

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4<f32> {
    const originCol = vec3<f32>(0.0, 0.0, 8.0);
    const faceThreshold = 0.0001;
    var texCol = textureSample(texture, mySampler, fragData.uv);
    var gridPos = fragData.rawPos;
    var gridScale = vec3<f32>(1, 1, 1);

    if (faceIDs[0].x == 1u && isNear(fragData.rawPos.z, 0.5, faceThreshold)) {
        // front
        return drawGrid(gridPos, gridScale, abs(fragData.worldPos) + originCol, texCol, 2);
    }
    if (faceIDs[1].x == 1u && isNear(fragData.rawPos.z, -0.5, faceThreshold)) {
        // back
        return drawGrid(gridPos, gridScale, abs(fragData.worldPos) + originCol, texCol, 2);
    }
    if (faceIDs[2].x == 1u && isNear(fragData.rawPos.x, -0.5, faceThreshold)) {
        // left
        return drawGrid(gridPos, gridScale, abs(fragData.worldPos) + originCol, texCol, 0);
    }
    if (faceIDs[3].x == 1u && isNear(fragData.rawPos.x, 0.5, faceThreshold)) {
        // right
        return drawGrid(gridPos, gridScale, abs(fragData.worldPos) + originCol, texCol, 0);
    }
    if (faceIDs[4].x == 1u && isNear(fragData.rawPos.y, 0.5, faceThreshold)) {
        // top
        return drawGrid(gridPos, gridScale, abs(fragData.worldPos) + originCol, texCol, 1);
    }
    if (faceIDs[5].x == 1u && isNear(fragData.rawPos.y, -0.5, faceThreshold)) {
        // bottom
        return drawGrid(gridPos, gridScale, abs(fragData.worldPos) + originCol, texCol, 1);
    }

    gridPos *=  fragData.scale;
    gridScale = fract(fragData.scale / 2);

    return drawGrid(gridPos, gridScale, abs(fragData.worldPos) + originCol, vec4<f32>(0, 0, 0, 1), 3);
}