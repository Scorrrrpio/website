struct VertexOutput {
    @location(0) rawPos: vec3f,
    @builtin(position) position: vec4f
};

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    let threshold = 0.02;
    if (((fragData.rawPos[0] % 1 > -0.01 && fragData.rawPos[0] % 1 < 0.01)
    || fragData.rawPos[0] % 1 < -0.99 || fragData.rawPos[0] % 1 > 0.99)
    && fragData.rawPos[0] % 1 != 0) {
        return vec4f(fragData.rawPos, 1);
    }
    if (((fragData.rawPos[1] % 1 < 0.01 && fragData.rawPos[1] % 1 > -0.01)
    || fragData.rawPos[1] % 1 >= 0.99 || fragData.rawPos[1] % 1 <= -0.99)
    && fragData.rawPos[1] % 1 != 0) {
        return vec4f(fragData.rawPos, 1);
    }
    if (((fragData.rawPos[2] % 1 < 0.01 && fragData.rawPos[2] % 1 > -0.01)
    || fragData.rawPos[2] % 1 >= 0.99 || fragData.rawPos[2] % 1 <= -0.99)
    && fragData.rawPos[2] % 1 != 0) {
        return vec4f(fragData.rawPos, 1);
    }
    return vec4f(0, 0, 0, 1);
}