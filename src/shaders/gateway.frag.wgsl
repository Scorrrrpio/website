struct VertexOutput {
    @location(0) rawPos: vec3f,
    @location(1) worldPos: vec3f,
    @location(2) scale: vec3f,
    @builtin(position) position: vec4f
};

fn drawGrid(pos: vec3f, evenScale: vec3f, colour: vec3f, clear: vec4f) -> vec4f {
    var gridPos = (abs(pos) + 0.5 * evenScale) % 1.0;
    var c = vec4f(colour.r / 64.0, colour.g / 64.0, 1 - colour.r / 64 - colour.g / 64, 1);
    if ((gridPos.x < 0.01 || gridPos.x > 0.99) && abs(pos.x) % 1.0 != 0.5 * evenScale.x) {
        return c;
    }
    if ((gridPos.z < 0.01 || gridPos.z > 0.99) && abs(pos.z) % 1.0 != 0.5 * evenScale.z) {
        return c;
    }
    if ((gridPos.y < 0.01 || gridPos.y > 0.99) && abs(pos.y) % 1.0 != 0.5 * evenScale.y) {
        //return vec4f(0, 0, 0, 1);
        return c;
    }
    return clear;
}

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    var evenScale = vec3f(16, 16, 16);

    return drawGrid(fragData.rawPos, evenScale, abs(fragData.worldPos), vec4f(0, 0, 0, 1));
}