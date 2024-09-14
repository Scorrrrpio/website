struct VertexOutput {
    @location(0) rawPos: vec3f,
    @builtin(position) position: vec4f
};

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    if ((abs(fragData.rawPos[0] % 0.1) < 0.001 || abs(fragData.rawPos[0] % 0.1) >= 0.099)
    && fragData.rawPos[0] % 0.1 != 0) {
        return vec4f(fragData.rawPos, 1);
    }
    if ((abs(fragData.rawPos[1] % 0.1) < 0.001 || abs(fragData.rawPos[1] % 0.1) >= 0.099)
    && fragData.rawPos[1] % 0.1 != 0) {
        return vec4f(fragData.rawPos, 1);
    }
    if ((abs(fragData.rawPos[2] % 0.1) < 0.001 || abs(fragData.rawPos[2] % 0.1) >= 0.099)
    && fragData.rawPos[2] % 0.1 != 0) {
        return vec4f(fragData.rawPos, 1);
    }
    return vec4f(0, 0, 0, 1);
}