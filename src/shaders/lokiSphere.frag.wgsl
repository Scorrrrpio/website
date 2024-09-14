struct VertexOutput {
    @location(0) barycentric: vec3f,
    @builtin(position) position: vec4f
};

@fragment
fn fragmentMain(fragData: VertexOutput) -> @location(0) vec4f {
    let threshold = 0.02;
    if (min(min(fragData.barycentric.x, fragData.barycentric.y), fragData.barycentric.z) >= threshold) {
        return vec4f(0, 0, 0, 0);
    }
    return vec4f(1, 1, 1, 1);
}