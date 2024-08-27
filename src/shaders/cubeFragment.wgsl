struct VertexOutput {
    @location(0) rawPos: vec3f,
    @location(1) worldPos: vec3f,
    @location(2) scale: vec3f,
    @builtin(position) position: vec4f
};

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    var colour = vec4f(0, 0, 0, 1);
    if ((abs(fragData.rawPos[0] % 1) < 0.01 || abs(fragData.rawPos[0] % 1) >= 0.99)
    && fragData.rawPos[0] % 1 != 0) {
        return vec4f((abs(fragData.worldPos) + vec3f(0, 0, 8.0)) / 8.0, 1);
    }
    if ((abs(fragData.rawPos[1] % 1) < 0.01 || abs(fragData.rawPos[1] % 1) >= 0.99)
    && fragData.rawPos[1] % 1 != 0) {
        return vec4f((abs(fragData.worldPos) + vec3f(0, 0, 8.0)) / 8.0, 1);
    }
    if ((abs(fragData.rawPos[2] % 1) < 0.01 || abs(fragData.rawPos[2] % 1) >= 0.99)
    && fragData.rawPos[2] % 1 != 0) {
        return vec4f((abs(fragData.worldPos) + vec3f(0, 0, 8.0)) / 8.0, 1);
    }
    return colour;
}