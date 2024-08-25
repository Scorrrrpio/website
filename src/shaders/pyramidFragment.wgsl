struct VertexOutput {
    @location(0) rawPos: vec3f,
    @location(1) barycentric: vec3f,
    @builtin(position) position: vec4f
};

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    let threshold = 0.02;
    if ((abs(fragData.rawPos[1] % 1) < 0.01 || abs(fragData.rawPos[1] % 1) >= 0.99)
    && fragData.rawPos[1] % 1 != 0) {
        return vec4f(fragData.rawPos, 1);
    }
    if (min(min(fragData.barycentric.x, fragData.barycentric.y), fragData.barycentric.z) < threshold) {
        return vec4f(fragData.rawPos, 1);
    }
    return vec4f(0, 0, 0, 1);
}